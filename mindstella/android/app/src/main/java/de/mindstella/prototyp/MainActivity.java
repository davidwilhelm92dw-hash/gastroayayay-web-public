package de.mindstella.prototyp;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MindstellaPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
