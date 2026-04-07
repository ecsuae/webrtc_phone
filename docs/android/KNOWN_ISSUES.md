# Android: Known Issues

- Many Android web runtimes do not expose output device selection (`setSinkId` unavailable).
- `enumerateDevices()` may only return a single `audiooutput` entry labeled `Default`.
- True earpiece vs speaker routing may require a native bridge (AudioManager / communication mode).
