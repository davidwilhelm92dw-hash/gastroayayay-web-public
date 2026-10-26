package de.mindstella.prototyp;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;
import java.io.IOException;

/**
 * Wiedergabe der lokal eingebundenen Wissensfolge mit Audiofokus.
 * Fremde Wiedergabe (z. B. Spotify) wird nach Betriebssystemverhalten
 * behandelt; eine Fernsteuerung anderer Apps findet nicht statt.
 */
final class PodcastPlayer {
    interface Listener {
        void onState(String state);
    }

    private static final String TAG = "MindstellaPodcast";

    private final Context ctx;
    private final AudioManager audioManager;
    private final Listener listener;
    private MediaPlayer player;
    private AudioFocusRequest focusRequest;
    private boolean prepared;
    private boolean resumeOnFocusGain;
    private String loadedAsset;

    PodcastPlayer(Context ctx, Listener listener) {
        this.ctx = ctx.getApplicationContext();
        this.audioManager = (AudioManager) this.ctx.getSystemService(Context.AUDIO_SERVICE);
        this.listener = listener;
    }

    /** @return Dauer in Sekunden oder -1, wenn die Datei fehlt */
    synchronized double load(String asset) {
        if (prepared && asset.equals(loadedAsset)) return player.getDuration() / 1000.0;
        release();
        try (AssetFileDescriptor fd = ctx.getAssets().openFd("public/" + asset)) {
            player = new MediaPlayer();
            player.setAudioAttributes(attributes());
            player.setWakeMode(ctx, PowerManager.PARTIAL_WAKE_LOCK);
            player.setDataSource(fd.getFileDescriptor(), fd.getStartOffset(), fd.getLength());
            player.prepare();
            player.setOnCompletionListener(mp -> {
                abandonFocus();
                listener.onState("ended");
            });
            prepared = true;
            loadedAsset = asset;
            return player.getDuration() / 1000.0;
        } catch (IOException | RuntimeException e) {
            Log.i(TAG, "Wissensfolge nicht vorhanden: " + asset);
            release();
            return -1;
        }
    }

    synchronized boolean play(double positionSec) {
        if (!prepared) return false;
        if (!requestFocus()) return false;
        if (positionSec >= 0) player.seekTo((int) (positionSec * 1000));
        player.start();
        resumeOnFocusGain = false;
        listener.onState("playing");
        return true;
    }

    synchronized void pause() {
        if (prepared && player.isPlaying()) {
            player.pause();
            listener.onState("paused");
        }
        resumeOnFocusGain = false;
        abandonFocus();
    }

    synchronized void seek(double positionSec) {
        if (prepared) player.seekTo((int) (positionSec * 1000));
    }

    synchronized boolean isPlaying() {
        return prepared && player.isPlaying();
    }

    synchronized double position() {
        return prepared ? player.getCurrentPosition() / 1000.0 : 0;
    }

    synchronized double duration() {
        return prepared ? player.getDuration() / 1000.0 : 0;
    }

    synchronized void release() {
        abandonFocus();
        if (player != null) {
            player.release();
            player = null;
        }
        prepared = false;
        loadedAsset = null;
    }

    private AudioAttributes attributes() {
        return new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build();
    }

    private final AudioManager.OnAudioFocusChangeListener focusListener = change -> {
        synchronized (PodcastPlayer.this) {
            if (!prepared) return;
            switch (change) {
                case AudioManager.AUDIOFOCUS_LOSS:
                    // Dauerhafter Verlust, z. B. Spotify startet: anhalten, nicht selbst fortsetzen.
                    if (player.isPlaying()) player.pause();
                    resumeOnFocusGain = false;
                    abandonFocus();
                    listener.onState("focusLost");
                    break;
                case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                    // Sprachfolge pausiert kurz (z. B. Anruf, Navigationsansage).
                    if (player.isPlaying()) {
                        player.pause();
                        resumeOnFocusGain = true;
                        listener.onState("paused");
                    }
                    break;
                case AudioManager.AUDIOFOCUS_GAIN:
                    if (resumeOnFocusGain) {
                        resumeOnFocusGain = false;
                        player.start();
                        listener.onState("playing");
                    }
                    break;
                default:
                    break;
            }
        }
    };

    private boolean requestFocus() {
        if (audioManager == null) return true;
        int result;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(attributes())
                .setWillPauseWhenDucked(true)
                .setOnAudioFocusChangeListener(focusListener)
                .build();
            result = audioManager.requestAudioFocus(focusRequest);
        } else {
            result = audioManager.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
        }
        return result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
    }

    private void abandonFocus() {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (focusRequest != null) audioManager.abandonAudioFocusRequest(focusRequest);
            focusRequest = null;
        } else {
            audioManager.abandonAudioFocus(focusListener);
        }
    }
}
