using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public enum RushDistrict { NeoDowntown, CyberHarbor, Skyline, OldMetro }

    public sealed class RushCityRouteDirector : MonoBehaviour
    {
        public static RushCityRouteDirector Instance { get; private set; }
        [SerializeField] float branchOffset = 9.5f;
        [SerializeField] float maxCenterOffset = 19f;
        [SerializeField] float centerTransitionTime = .72f;

        public float CurrentCenterX { get; private set; }
        public float TargetCenterX { get; private set; }
        public RushDistrict District { get; private set; } = RushDistrict.NeoDowntown;
        public int BranchCount { get; private set; }

        float _centerVelocity;

        void Awake(){Instance=this;}

        void Update()
        {
            CurrentCenterX=Mathf.SmoothDamp(CurrentCenterX,TargetCenterX,ref _centerVelocity,centerTransitionTime,38f,Time.deltaTime);
        }

        public int SuggestedDirection(int lane)
        {
            if(lane<=0)return -1;
            if(lane>=2)return 1;
            if(Mathf.Abs(TargetCenterX)>.1f)return TargetCenterX>0?-1:1;
            return BranchCount%2==0?1:-1;
        }

        public void ChooseBranch(int direction,float choiceWorldZ)
        {
            direction=direction<0?-1:1;
            var previous=TargetCenterX;
            TargetCenterX=Mathf.Clamp(TargetCenterX+direction*branchOffset,-maxCenterOffset,maxCenterOffset);
            var delta=TargetCenterX-previous;
            if(Mathf.Abs(delta)<.1f)
            {
                TargetCenterX=Mathf.MoveTowards(TargetCenterX,0f,branchOffset);
                delta=TargetCenterX-previous;
            }
            BranchCount++;
            District=NextDistrict(direction);
            RushCityTrackManager.Instance?.ShiftFutureSegments(choiceWorldZ+7f,delta);
            RushCityGameManager.Instance?.RegisterRouteChoice(direction,District.ToString());
        }

        RushDistrict NextDistrict(int direction)
        {
            var index=(int)District;
            index=(index+(direction>0?1:3))%4;
            return (RushDistrict)index;
        }
    }
}
