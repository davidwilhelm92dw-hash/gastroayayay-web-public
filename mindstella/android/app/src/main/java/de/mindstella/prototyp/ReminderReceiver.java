package de.mindstella.prototyp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Rückfallebene der Rückkehrhilfe, ausgelöst durch AlarmManager. */
public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        long token = intent.getLongExtra(ReminderController.EXTRA_TOKEN, 0L);
        ReminderController.fire(context.getApplicationContext(), token, "alarm");
    }
}
