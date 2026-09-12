#if UNITY_EDITOR
using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace Zoryq.Play.RushCity.Editor
{
    public static class RushCityCiBuild
    {
        public static void BuildAll()
        {
            RushCitySceneBuilder.Build();
            ConfigureAndroidPlayer();

            var root=Path.GetFullPath(Path.Combine(Application.dataPath,"..","build"));
            Directory.CreateDirectory(root);

            var apkPath=Path.Combine(root,"ZORYQ-Rush-City-Vertical-Slice.apk");
            EditorUserBuildSettings.exportAsGoogleAndroidProject=false;
            Build(apkPath,BuildOptions.CompressWithLz4HC);

            var gradlePath=Path.Combine(root,"RushCity-AndroidStudio");
            if(Directory.Exists(gradlePath))Directory.Delete(gradlePath,true);
            EditorUserBuildSettings.exportAsGoogleAndroidProject=true;
            Build(gradlePath,BuildOptions.AcceptExternalModificationsToPlayer);

            var unityLibrary=Path.Combine(gradlePath,"unityLibrary");
            if(!Directory.Exists(unityLibrary))throw new Exception("Unity Android export did not produce unityLibrary module.");
            File.WriteAllText(Path.Combine(root,"BUILD_INFO.txt"),
                $"ZORYQ Rush City\nUnity={Application.unityVersion}\nUTC={DateTime.UtcNow:O}\nScene=RushCityVerticalSlice\nAPK={Path.GetFileName(apkPath)}\nAndroidLibrary={unityLibrary}\n");
            Debug.Log($"[ZORYQ CI] Rush City APK + Android Studio unityLibrary exported to {root}");
        }

        static void ConfigureAndroidPlayer()
        {
            PlayerSettings.productName="ZORYQ Rush City";
            PlayerSettings.companyName="ZORYQ Network";
            PlayerSettings.bundleVersion="0.1.0";
#pragma warning disable CS0618
            PlayerSettings.SetApplicationIdentifier(BuildTargetGroup.Android,"com.zoryq.games.rushcity");
            PlayerSettings.SetScriptingBackend(BuildTargetGroup.Android,ScriptingImplementation.IL2CPP);
#pragma warning restore CS0618
            PlayerSettings.Android.bundleVersionCode=1;
            PlayerSettings.Android.minSdkVersion=AndroidApiLevel.AndroidApiLevel24;
            PlayerSettings.Android.targetSdkVersion=AndroidApiLevel.AndroidApiLevelAuto;
            PlayerSettings.Android.targetArchitectures=AndroidArchitecture.ARM64;
            PlayerSettings.Android.useCustomKeystore=false;
            PlayerSettings.stripEngineCode=true;
        }

        static void Build(string output,BuildOptions extra)
        {
            var options=new BuildPlayerOptions
            {
                scenes=new[]{"Assets/ZORYQ/RushCity/Scenes/RushCityVerticalSlice.unity"},
                locationPathName=output,
                target=BuildTarget.Android,
                options=extra
            };
            var report=BuildPipeline.BuildPlayer(options);
            if(report.summary.result!=BuildResult.Succeeded)
                throw new Exception($"Rush City Android build failed: {report.summary.result}, errors={report.summary.totalErrors}");
            Debug.Log($"[ZORYQ CI] build success output={output} size={report.summary.totalSize}");
        }
    }
}
#endif
