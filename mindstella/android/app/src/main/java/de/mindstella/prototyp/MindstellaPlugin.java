package de.mindstella.prototyp;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import androidx.activity.result.ActivityResult;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Gerätefunktionen für Mindstella: Spracheingabe über den Systemdienst,
 * Sprachausgabe, Rückkehrhilfe, Wissensfolge und externe Links.
 */
@CapacitorPlugin(
    name = "Mindstella",
    permissions = { @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications") }
)
public class MindstellaPlugin extends Plugin {

    private TextToSpeech tts;
    private boolean ttsReady;
    private boolean ttsInitDone;
    private final List<Runnable> ttsQueue = new ArrayList<>();
    private final Map<String, PluginCall> ttsCalls = new HashMap<>();
    private PodcastPlayer podcast;
    private BroadcastReceiver screenOffReceiver;

    @Override
    public void load() {
        Context ctx = getContext();
        ReminderController.createChannel(ctx);
        podcast = new PodcastPlayer(ctx, state -> {
            JSObject ev = new JSObject();
            ev.put("state", state);
            notifyListeners("podcastState", ev);
        });

        screenOffReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                ReminderController.onScreenOff(context);
            }
        };
        ContextCompat.registerReceiver(
            ctx.getApplicationContext(),
            screenOffReceiver,
            new IntentFilter(Intent.ACTION_SCREEN_OFF),
            ContextCompat.RECEIVER_NOT_EXPORTED
        );

        tts = new TextToSpeech(ctx, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int r = tts.setLanguage(Locale.GERMANY);
                ttsReady = r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED;
            }
            List<Runnable> queued;
            synchronized (ttsQueue) {
                ttsInitDone = true;
                queued = new ArrayList<>(ttsQueue);
                ttsQueue.clear();
            }
            for (Runnable q : queued) q.run();
        });
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override
            public void onStart(String utteranceId) {}

            @Override
            public void onDone(String utteranceId) {
                finishUtterance(utteranceId);
            }

            @Override
            @Deprecated
            public void onError(String utteranceId) {
                finishUtterance(utteranceId);
            }

            @Override
            public void onStop(String utteranceId, boolean interrupted) {
                finishUtterance(utteranceId);
            }
        });
    }

    /* ---------- Lebenszyklus für die Rückkehrhilfe ---------- */

    @Override
    protected void handleOnResume() {
        ReminderController.onAppVisible(getContext());
    }

    @Override
    protected void handleOnStop() {
        ReminderController.onAppHidden(getContext());
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) tts.shutdown();
        if (podcast != null) podcast.release();
        try {
            getContext().getApplicationContext().unregisterReceiver(screenOffReceiver);
        } catch (IllegalArgumentException ignored) {
            // bereits abgemeldet
        }
    }

    /* ---------- Spracheingabe ---------- */

    private Intent recognizerIntent(String prompt) {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "de-DE");
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        if (prompt != null) intent.putExtra(RecognizerIntent.EXTRA_PROMPT, prompt);
        return intent;
    }

    @PluginMethod
    public void speechAvailable(PluginCall call) {
        boolean available = recognizerIntent(null).resolveActivity(getContext().getPackageManager()) != null;
        JSObject ret = new JSObject();
        ret.put("available", available);
        if (!available) ret.put("reason", "Auf diesem Gerät ist kein Spracherkennungsdienst eingerichtet.");
        call.resolve(ret);
    }

    @PluginMethod
    public void startSpeech(PluginCall call) {
        try {
            startActivityForResult(call, recognizerIntent(call.getString("prompt")), "onSpeechResult");
        } catch (ActivityNotFoundException e) {
            call.reject("Kein Spracherkennungsdienst verfügbar.");
        }
    }

    @ActivityCallback
    private void onSpeechResult(PluginCall call, ActivityResult result) {
        JSObject ret = new JSObject();
        Intent data = result.getData();
        if (result.getResultCode() == android.app.Activity.RESULT_OK && data != null) {
            ArrayList<String> matches = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (matches != null && !matches.isEmpty()) {
                ret.put("text", matches.get(0));
                call.resolve(ret);
                return;
            }
        }
        ret.put("error", "Nichts erkannt oder abgebrochen.");
        call.resolve(ret);
    }

    /* ---------- Sprachausgabe ---------- */

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        Runnable job = () -> {
            if (!ttsReady || text.isEmpty()) {
                call.resolve();
                return;
            }
            String id = "u" + System.nanoTime();
            synchronized (ttsCalls) {
                ttsCalls.put(id, call);
            }
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id);
        };
        if (tts == null) {
            call.resolve();
            return;
        }
        boolean runNow;
        synchronized (ttsQueue) {
            runNow = ttsInitDone;
            if (!runNow) ttsQueue.add(job);
        }
        if (runNow) job.run();
    }

    private void finishUtterance(String id) {
        PluginCall c;
        synchronized (ttsCalls) {
            c = ttsCalls.remove(id);
        }
        if (c != null) c.resolve();
    }

    @PluginMethod
    public void stopSpeaking(PluginCall call) {
        if (tts != null) tts.stop();
        call.resolve();
    }

    /* ---------- Rückkehrhilfe ---------- */

    @PluginMethod
    public void setReminderContext(PluginCall call) {
        ReminderController.setContext(
            getContext(),
            Boolean.TRUE.equals(call.getBoolean("armed", false)),
            call.getString("title", ""),
            call.getString("step", "")
        );
        call.resolve();
    }

    private String notificationState() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            PermissionState s = getPermissionState("notifications");
            if (s == PermissionState.GRANTED) return "granted";
            if (s == PermissionState.DENIED) return "denied";
            return "prompt";
        }
        return NotificationManagerCompat.from(getContext()).areNotificationsEnabled() ? "granted" : "denied";
    }

    @PluginMethod
    public void notificationStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("state", notificationState());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !"granted".equals(notificationState())) {
            requestPermissionForAlias("notifications", call, "onNotificationPermission");
            return;
        }
        notificationStatus(call);
    }

    @PermissionCallback
    private void onNotificationPermission(PluginCall call) {
        notificationStatus(call);
    }

    /* ---------- Wissensfolge ---------- */

    @PluginMethod
    public void podcastLoad(PluginCall call) {
        double duration = podcast.load(call.getString("asset", ""));
        JSObject ret = new JSObject();
        ret.put("available", duration >= 0);
        if (duration >= 0) ret.put("duration", duration);
        call.resolve(ret);
    }

    @PluginMethod
    public void podcastPlay(PluginCall call) {
        Double pos = call.getDouble("position");
        boolean ok = podcast.play(pos == null ? -1 : pos);
        if (ok) call.resolve();
        else call.reject("Wiedergabe nicht möglich (Datei fehlt oder Audiofokus verweigert).");
    }

    @PluginMethod
    public void podcastPause(PluginCall call) {
        podcast.pause();
        call.resolve();
    }

    @PluginMethod
    public void podcastSeek(PluginCall call) {
        Double pos = call.getDouble("position");
        if (pos != null) podcast.seek(pos);
        call.resolve();
    }

    @PluginMethod
    public void podcastStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("playing", podcast.isPlaying());
        ret.put("position", podcast.position());
        ret.put("duration", podcast.duration());
        call.resolve(ret);
    }

    /* ---------- Externe Links ---------- */

    @PluginMethod
    public void openUrl(PluginCall call) {
        String url = call.getString("url", "");
        if (!url.startsWith("https://") && !url.startsWith("spotify:")) {
            call.reject("Nur https- oder spotify-Links sind erlaubt.");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("Keine App zum Öffnen dieses Links gefunden.");
        }
    }
}
