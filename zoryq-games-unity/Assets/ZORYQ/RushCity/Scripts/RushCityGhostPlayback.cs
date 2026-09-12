using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityGhostPlayback : MonoBehaviour
    {
        [SerializeField] Transform ghostVisual;
        [SerializeField] float interpolationSharpness = 18f;
        RushGhostRun _run;
        int _index;
        bool _playing;

        public bool HasGhost => _run != null && _run.frames != null && _run.frames.Count > 1;

        public bool LoadJson(string json)
        {
            if(string.IsNullOrWhiteSpace(json))return false;
            try
            {
                var parsed=JsonUtility.FromJson<RushGhostRun>(json);
                if(parsed==null||parsed.version!="zoryq.rush.ghost.v1"||parsed.frames==null||parsed.frames.Count<2)return false;
                _run=parsed;_index=0;_playing=true;
                if(ghostVisual)ghostVisual.gameObject.SetActive(true);
                return true;
            }
            catch{return false;}
        }

        public void StopGhost(){_playing=false;if(ghostVisual)ghostVisual.gameObject.SetActive(false);}

        void Update()
        {
            var gm=RushCityGameManager.Instance;
            if(!_playing||!HasGhost||!ghostVisual||!gm||!gm.IsRunning)return;
            var t=gm.DurationSeconds;
            while(_index<_run.frames.Count-2&&_run.frames[_index+1].t<=t)_index++;
            var a=_run.frames[_index];var b=_run.frames[Mathf.Min(_index+1,_run.frames.Count-1)];
            var span=Mathf.Max(.001f,b.t-a.t);var u=Mathf.Clamp01((t-a.t)/span);
            var target=Vector3.Lerp(new Vector3(a.x,a.y,a.z),new Vector3(b.x,b.y,b.z),u);
            var targetRot=Quaternion.Euler(0,Mathf.LerpAngle(a.yaw,b.yaw,u),0);
            var k=1f-Mathf.Exp(-interpolationSharpness*Time.deltaTime);
            ghostVisual.position=Vector3.Lerp(ghostVisual.position,target,k);
            ghostVisual.rotation=Quaternion.Slerp(ghostVisual.rotation,targetRot,k);
            if(t>_run.durationSeconds+.25f)StopGhost();
        }
    }
}
