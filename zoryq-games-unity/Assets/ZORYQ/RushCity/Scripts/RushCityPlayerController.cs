using System.Collections;
using UnityEngine;

namespace Zoryq.Play.RushCity
{
    [RequireComponent(typeof(CharacterController))]
    public sealed class RushCityPlayerController : MonoBehaviour
    {
        [Header("Lane movement")]
        [SerializeField] float laneWidth = 2.65f;
        [SerializeField] float laneSnapTime = .085f;
        [SerializeField] float lateralMaxSpeed = 24f;

        [Header("Parkour")]
        [SerializeField] float jumpHeight = 2.8f;
        [SerializeField] float gravity = -28f;
        [SerializeField] float slideDuration = .72f;
        [SerializeField] float wallRunDuration = .82f;
        [SerializeField] float wallRunGravity = -3.8f;
        [SerializeField] float wallProbeDistance = 1.05f;
        [SerializeField] LayerMask wallMask = ~0;

        [Header("Input")]
        [SerializeField] float swipeThreshold = 55f;

        CharacterController _controller;
        int _lane = 1;
        float _verticalVelocity;
        float _laneVelocity;
        bool _sliding;
        bool _wallRunning;
        Vector2 _touchStart;
        float _defaultHeight;
        Vector3 _defaultCenter;

        public int Lane => _lane;
        public bool IsSliding => _sliding;
        public bool IsWallRunning => _wallRunning;

        void Awake()
        {
            _controller = GetComponent<CharacterController>();
            _defaultHeight = _controller.height;
            _defaultCenter = _controller.center;
        }

        void Update()
        {
            var gm = RushCityGameManager.Instance;
            if (gm == null || !gm.IsRunning) return;
            ReadInput();
            var targetX = (_lane - 1) * laneWidth;
            var x = Mathf.SmoothDamp(transform.position.x, targetX, ref _laneVelocity, laneSnapTime, lateralMaxSpeed);
            var lateral = (x - transform.position.x) / Mathf.Max(Time.deltaTime, .0001f);
            if (_controller.isGrounded && _verticalVelocity < 0) _verticalVelocity = -2f;
            _verticalVelocity += (_wallRunning ? wallRunGravity : gravity) * Time.deltaTime;
            _controller.Move(new Vector3(lateral, _verticalVelocity, gm.CurrentSpeed) * Time.deltaTime);
            if (transform.position.y < -4f) gm.EndRun("fell");
        }

        void ReadInput()
        {
#if UNITY_EDITOR || UNITY_STANDALONE
            if (Input.GetKeyDown(KeyCode.LeftArrow) || Input.GetKeyDown(KeyCode.A)) ChangeLane(-1);
            if (Input.GetKeyDown(KeyCode.RightArrow) || Input.GetKeyDown(KeyCode.D)) ChangeLane(1);
            if (Input.GetKeyDown(KeyCode.UpArrow) || Input.GetKeyDown(KeyCode.Space)) Jump();
            if (Input.GetKeyDown(KeyCode.DownArrow) || Input.GetKeyDown(KeyCode.S)) StartCoroutine(Slide());
#endif
            if (Input.touchCount == 0) return;
            var touch = Input.GetTouch(0);
            if (touch.phase == TouchPhase.Began) _touchStart = touch.position;
            if (touch.phase != TouchPhase.Ended) return;
            var delta = touch.position - _touchStart;
            if (delta.magnitude < swipeThreshold) return;
            if (Mathf.Abs(delta.x) > Mathf.Abs(delta.y)) ChangeLane(delta.x > 0 ? 1 : -1);
            else if (delta.y > 0) Jump();
            else StartCoroutine(Slide());
        }

        void ChangeLane(int direction)
        {
            var before=_lane;
            _lane = Mathf.Clamp(_lane + direction, 0, 2);
            if(_lane==before)return;
            RushCityTelemetry.Instance?.LaneChange();
            RushCityGhostRecorder.Instance?.MarkLaneChange();
        }

        void Jump()
        {
            if (_controller.isGrounded)
            {
                _verticalVelocity = Mathf.Sqrt(jumpHeight * -2f * gravity);
                RushCityTelemetry.Instance?.Jump();
                RushCityGhostRecorder.Instance?.MarkJump();
                return;
            }
            TryWallRun();
        }

        void TryWallRun()
        {
            if (_wallRunning) return;
            var left = Physics.Raycast(transform.position + Vector3.up, Vector3.left, wallProbeDistance, wallMask, QueryTriggerInteraction.Ignore);
            var right = Physics.Raycast(transform.position + Vector3.up, Vector3.right, wallProbeDistance, wallMask, QueryTriggerInteraction.Ignore);
            if (!left && !right) return;
            StartCoroutine(WallRun());
        }

        IEnumerator WallRun()
        {
            _wallRunning = true;
            _verticalVelocity = 1.2f;
            RushCityTelemetry.Instance?.WallRun();
            RushCityGhostRecorder.Instance?.MarkWallRun();
            RushCityGameManager.Instance?.RegisterCleanParkour();
            yield return new WaitForSeconds(wallRunDuration);
            _wallRunning = false;
        }

        IEnumerator Slide()
        {
            if (_sliding || !_controller.isGrounded) yield break;
            _sliding = true;
            RushCityTelemetry.Instance?.Slide();
            RushCityGhostRecorder.Instance?.MarkSlide();
            _controller.height = _defaultHeight * .48f;
            _controller.center = new Vector3(_defaultCenter.x, _defaultCenter.y * .48f, _defaultCenter.z);
            yield return new WaitForSeconds(slideDuration);
            _controller.height = _defaultHeight;
            _controller.center = _defaultCenter;
            _sliding = false;
            RushCityGameManager.Instance?.RegisterCleanParkour();
        }

        void OnTriggerEnter(Collider other)
        {
            var collectible = other.GetComponent<RushCityCollectible>();
            if (collectible != null) collectible.Collect();
        }

        void OnControllerColliderHit(ControllerColliderHit hit)
        {
            var obstacle = hit.collider.GetComponent<RushCityObstacle>();
            if (obstacle != null) obstacle.Hit(this);
        }
    }
}
