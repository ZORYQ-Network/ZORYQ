using System;
using UnityEngine;

namespace Zoryq.Play
{
    [Serializable]
    public sealed class GameRunResult
    {
        public string version = "zoryq.play.run.v1";
        public string gameId = "rush-city";
        public string sessionId;
        public int score;
        public int zqCollected;
        public float distanceMeters;
        public float durationSeconds;
        public string integrity = "client-untrusted";
    }

    /// <summary>
    /// Narrow bridge from game runtime back to ZORYQ Play. It never exposes wallet keys or balances.
    /// Client reward data is explicitly untrusted; a backend must validate production rewards.
    /// </summary>
    public static class ZoryqPlayBridge
    {
        public static string Serialize(GameRunResult result) => JsonUtility.ToJson(result);

        public static void ReportAndReturn(GameRunResult result)
        {
            var json = Serialize(result);
            Debug.Log($"[ZORYQ PLAY] run result: {json}");

#if UNITY_ANDROID && !UNITY_EDITOR
            try
            {
                using var unityPlayer = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
                using var activity = unityPlayer.GetStatic<AndroidJavaObject>("currentActivity");
                using var intent = new AndroidJavaObject("android.content.Intent");
                intent.Call<AndroidJavaObject>("putExtra", "zoryq_play_result", json);
                activity.Call("setResult", -1, intent); // Activity.RESULT_OK
                activity.Call("finish");
                return;
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[ZORYQ PLAY] Android return bridge unavailable: {e.Message}");
            }
#endif
            PlayerPrefs.SetString("zoryq.play.last.result", json);
            PlayerPrefs.Save();
        }
    }
}
