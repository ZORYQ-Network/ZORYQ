# Build notes

Android packaging should use a minimal native shell or trusted webview/PWA wrapper only if background execution requirements can be met safely. Foreground-service behavior must respect Android platform restrictions and visibly inform the user when active.
