using System.Collections;
using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityGhostRaceManager : MonoBehaviour
    {
        public static RushCityGhostRaceManager Instance { get; private set; }
        const string BestGhostKey="zoryq.rush.ghost.best.v1";
        const string BestScoreKey="zoryq.rush.ghost.bestScore.v1";
        [SerializeField] RushCityGhostPlayback playback;

        void Awake(){Instance=this;}
        void Start(){StartCoroutine(LoadPreviousGhost());}

        public void Configure(RushCityGhostPlayback ghostPlayback){playback=ghostPlayback;}
        bool EnabledByLiveOps=>!RushCityLiveOpsConfig.Instance||RushCityLiveOpsConfig.Instance.Current.ghostRaceEnabled;

        IEnumerator LoadPreviousGhost()
        {
            yield return null;
            if(!EnabledByLiveOps){playback?.StopGhost();yield break;}
            if(!playback)playback=FindObjectOfType<RushCityGhostPlayback>();
            var json=PlayerPrefs.GetString(BestGhostKey,string.Empty);
            if(!string.IsNullOrEmpty(json))playback?.LoadJson(json);
        }

        public void FinishAndStoreCurrentRun()
        {
            if(!EnabledByLiveOps)return;
            var gm=RushCityGameManager.Instance;
            var recorder=RushCityGhostRecorder.Instance;
            if(!gm||!recorder)return;
            var json=recorder.ExportJson();
            if(string.IsNullOrEmpty(json))return;
            var best=PlayerPrefs.GetInt(BestScoreKey,0);
            if(gm.Score<=best)return;
            PlayerPrefs.SetInt(BestScoreKey,gm.Score);
            PlayerPrefs.SetString(BestGhostKey,json);
            PlayerPrefs.Save();
            Debug.Log($"[Rush City] personal best ghost saved score={gm.Score}");
        }

        public bool LoadExternalGhost(string json)
        {
            if(!EnabledByLiveOps)return false;
            if(!playback)playback=FindObjectOfType<RushCityGhostPlayback>();
            return playback&&playback.LoadJson(json);
        }
    }
}
