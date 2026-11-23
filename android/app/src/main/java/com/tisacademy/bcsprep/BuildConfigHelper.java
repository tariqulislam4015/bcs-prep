package com.tisacademy.bcsprep;

import android.content.Context;

/** Reads the app version without needing the generated BuildConfig class. */
final class BuildConfigHelper {
    private BuildConfigHelper() {}

    static String versionName(Context c) {
        try {
            return c.getPackageManager().getPackageInfo(c.getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "1";
        }
    }
}
