package app.notifyme.client;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NotifyDevicePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
