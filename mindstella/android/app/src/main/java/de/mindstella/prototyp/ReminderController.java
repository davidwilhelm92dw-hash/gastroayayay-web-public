package de.mindstella.prototyp;

import android.app.AlarmManager;
import android.app.KeyguardManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * Einzelne Rückkehrhilfe nach 30 Sekunden außerhalb der App.
 *
 * Regeln:
 *  - nur bei aktiver, nicht pausierter Aufgabe (armed)
 *  - nur wenn die App bei sichtbarem, entsperrtem Display verlassen wurde
 *  - Rückkehr, Pause, Abschluss oder Displaysperre heben die Erinnerung auf
 *  - höchstens eine Benachrichtigung pro Verlassen, keine Serie
 *
 * Zeitgeber: Ein Handler im laufenden Prozess sorgt für die genaue
 * Verzögerung. Ein nicht exakter AlarmManager-Alarm dient als Rückfallebene,
 * falls der Prozess im Hintergrund eingefroren wird; er kann sich um bis zu
 * etwa 75 % der Wartezeit verspäten. Ein Token sorgt dafür, dass nur der
 * zuerst auslösende Weg eine Benachrichtigung zeigt.
 */
final class ReminderController {
    static final String TAG = "MindstellaReminder";
    static final String CHANNEL_ID = "rueckkehr";
    static final int NOTIFICATION_ID = 4101;
    static final long DELAY_MS = 30_000L;
    static final String EXTRA_TOKEN = "token";

    private static final String PREFS = "mindstella_reminder";
    private static final String KEY_ARMED = "armed";
    private static final String KEY_TITLE = "title";
    private static final String KEY_STEP = "step";
    private static final String KEY_PENDING = "pendingToken";
    private static final String KEY_VISIBLE = "appVisible";

    private static final Handler handler = new Handler(Looper.getMainLooper());
    private static Runnable pendingRunnable;

    private ReminderController() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void createChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            ctx.getString(R.string.reminder_channel_name),
            NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription(ctx.getString(R.string.reminder_channel_description));
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm != null) nm.createNotificationChannel(channel);
    }

    static void setContext(Context ctx, boolean armed, String title, String step) {
        prefs(ctx).edit()
            .putBoolean(KEY_ARMED, armed)
            .putString(KEY_TITLE, title)
            .putString(KEY_STEP, step)
            .apply();
        if (!armed) cancel(ctx, "Aufgabe pausiert oder beendet");
    }

    static void onAppVisible(Context ctx) {
        prefs(ctx).edit().putBoolean(KEY_VISIBLE, true).apply();
        cancel(ctx, "App wieder im Vordergrund");
        NotificationManagerCompat.from(ctx).cancel(NOTIFICATION_ID);
    }

    static void onAppHidden(Context ctx) {
        prefs(ctx).edit().putBoolean(KEY_VISIBLE, false).apply();
        if (!prefs(ctx).getBoolean(KEY_ARMED, false)) return;
        if (!isScreenOnAndUnlocked(ctx)) {
            Log.d(TAG, "App durch Displaysperre verlassen: keine Erinnerung");
            return;
        }
        schedule(ctx);
    }

    static void onScreenOff(Context ctx) {
        cancel(ctx, "Display gesperrt");
    }

    static boolean isScreenOnAndUnlocked(Context ctx) {
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        KeyguardManager km = (KeyguardManager) ctx.getSystemService(Context.KEYGUARD_SERVICE);
        boolean interactive = pm == null || pm.isInteractive();
        boolean locked = km != null && km.isKeyguardLocked();
        return interactive && !locked;
    }

    private static void schedule(Context ctx) {
        final Context app = ctx.getApplicationContext();
        cancel(app, "neu planen");
        final long token = SystemClock.elapsedRealtimeNanos();
        prefs(app).edit().putLong(KEY_PENDING, token).apply();

        pendingRunnable = () -> fire(app, token, "handler");
        handler.postDelayed(pendingRunnable, DELAY_MS);

        AlarmManager am = (AlarmManager) app.getSystemService(Context.ALARM_SERVICE);
        if (am != null) {
            am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, SystemClock.elapsedRealtime() + DELAY_MS, alarmIntent(app, token));
        }
        Log.d(TAG, "Erinnerung in 30 s geplant");
    }

    private static PendingIntent alarmIntent(Context ctx, long token) {
        Intent intent = new Intent(ctx, ReminderReceiver.class);
        intent.putExtra(EXTRA_TOKEN, token);
        return PendingIntent.getBroadcast(
            ctx,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    static void cancel(Context ctx, String reason) {
        Context app = ctx.getApplicationContext();
        if (pendingRunnable != null) {
            handler.removeCallbacks(pendingRunnable);
            pendingRunnable = null;
        }
        if (prefs(app).getLong(KEY_PENDING, 0L) != 0L) {
            Log.d(TAG, "Erinnerung aufgehoben: " + reason);
        }
        prefs(app).edit().remove(KEY_PENDING).apply();
        AlarmManager am = (AlarmManager) app.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(alarmIntent(app, 0L));
    }

    static void fire(Context ctx, long token, String source) {
        SharedPreferences p = prefs(ctx);
        long pending = p.getLong(KEY_PENDING, 0L);
        if (pending == 0L || pending != token) return;
        p.edit().remove(KEY_PENDING).apply();
        if (pendingRunnable != null) {
            handler.removeCallbacks(pendingRunnable);
            pendingRunnable = null;
        }
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(alarmIntent(ctx, 0L));

        if (!p.getBoolean(KEY_ARMED, false) || p.getBoolean(KEY_VISIBLE, false)) return;
        if (!isScreenOnAndUnlocked(ctx)) return;
        if (!NotificationManagerCompat.from(ctx).areNotificationsEnabled()) {
            Log.d(TAG, "Benachrichtigungen nicht erlaubt: Erinnerung entfällt");
            return;
        }
        post(ctx, p.getString(KEY_TITLE, ""), p.getString(KEY_STEP, ""));
        Log.d(TAG, "Erinnerung gezeigt über " + source);
    }

    @SuppressWarnings("MissingPermission")
    private static void post(Context ctx, String title, String step) {
        createChannel(ctx);
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content = PendingIntent.getActivity(
            ctx,
            1,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        String heading = title == null || title.isEmpty() ? "Mindstella" : title;
        String text = step == null || step.isEmpty() ? "Dein nächster Schritt wartet." : "Dein Schritt: " + step;
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_mindstella)
            .setContentTitle(heading)
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(content)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT);
        try {
            NotificationManagerCompat.from(ctx).notify(NOTIFICATION_ID, b.build());
        } catch (SecurityException e) {
            Log.w(TAG, "Benachrichtigung abgelehnt", e);
        }
    }
}
