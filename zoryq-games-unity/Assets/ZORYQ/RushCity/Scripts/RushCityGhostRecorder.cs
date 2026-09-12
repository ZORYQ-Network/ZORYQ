using System;
using System.Collections.Generic;
using UnityEngine;

namespace Zoryq.Play.RushCity
{
    [Serializable]
    public sealed class RushGhostFrame
    {
        public float t;
        public float x;
        public float y;
        public float z;
        public float yaw;
        public byte action;
    }

    [Serializable]
    public sealed class RushGhostRun
    {
        public string version = "zoryq.rush.ghost.v1";
        public string sessionId;
        public float durationSeconds;
        public float distanceMeters;
        public int score;
        public List<RushGhostFrame> frames = new List<RushGhostFrame>();
    }

    public sealed class RushCityGhostRecorder : MonoBehaviour
    {
        public static RushCityGhostRecorder Instance { get; private set; }
        [SerializeField] Transform target;
        [SerializeField] float sampleInterval = .10f;
        [SerializeField] int maxFrames = 2400;

        readonly List<RushGhostFrame> _frames = new List<RushGhostFrame>(1800);
        float _nextSample;
        byte _pendingAction;

        void Awake(){Instance=this;}

        void Start()
        {
            if(!target)
            {
                var p=FindObjectOfType<RushCityPlayerController>();
                if(p)target=p.transform;
            }
            ResetRecording();
        }

        public void ResetRecording(){_frames.Clear();_nextSample=0f;_pendingAction=0;}

        void LateUpdate()
        {
            var gm=RushCityGameManager.Instance;
            if(!gm||!gm.IsRunning||!target||_frames.Count>=maxFrames)return;
            if(gm.DurationSeconds<_nextSample)return;
            _nextSample=gm.DurationSeconds+sampleInterval;
            var p=target.position;
            _frames.Add(new RushGhostFrame{t=gm.DurationSeconds,x=p.x,y=p.y,z=p.z,yaw=target.eulerAngles.y,action=_pendingAction});
            _pendingAction=0;
        }

        public void MarkLaneChange()=>_pendingAction=1;
        public void MarkJump()=>_pendingAction=2;
        public void MarkSlide()=>_pendingAction=3;
        public void MarkWallRun()=>_pendingAction=4;

        public string ExportJson()
        {
            var gm=RushCityGameManager.Instance;
            var run=new RushGhostRun{
                sessionId=gm?gm.SessionId:string.Empty,
                durationSeconds=gm?gm.DurationSeconds:0f,
                distanceMeters=gm?gm.DistanceMeters:0f,
                score=gm?gm.Score:0,
                frames=new List<RushGhostFrame>(_frames)
            };
            return JsonUtility.ToJson(run);
        }
    }
}
