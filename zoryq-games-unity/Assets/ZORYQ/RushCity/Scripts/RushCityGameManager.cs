using System;
using UnityEngine;
using Zoryq.Play;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityGameManager : MonoBehaviour
    {
        public static RushCityGameManager Instance { get; private set; }

        [Header("Pacing")]
        [SerializeField] float baseSpeed = 12f;
        [SerializeField] float maxSpeed = 30f;
        [SerializeField] float speedGainPerSecond = 0.16f;
        [SerializeField] float chasePressureGain = 0.018f;
        [SerializeField] float chasePressureRecovery = 0.11f;

        public bool IsRunning { get; private set; }
        public float CurrentSpeed { get; private set; }
        public float DistanceMeters { get; private set; }
        public float DurationSeconds { get; private set; }
        public float ChasePressure { get; private set; }
        public int ZqCollected { get; private set; }
        public int Score { get; private set; }
        public int Combo { get; private set; } = 1;
        public string SessionId { get; private set; }

        float _lastCollectTime;

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
        }

        void Start() => BeginRun();

        void Update()
        {
            if (!IsRunning) return;
            DurationSeconds += Time.deltaTime;
            CurrentSpeed = Mathf.Min(maxSpeed, baseSpeed + DurationSeconds * speedGainPerSecond);
            DistanceMeters += CurrentSpeed * Time.deltaTime;
            Score = Mathf.Max(Score, Mathf.RoundToInt(DistanceMeters * 10f) + ZqCollected * 25 * Combo);

            ChasePressure = Mathf.Clamp01(ChasePressure + chasePressureGain * Time.deltaTime);
            if (Time.time - _lastCollectTime < 0.75f)
                ChasePressure = Mathf.Clamp01(ChasePressure - chasePressureRecovery * Time.deltaTime);

            if (Time.time - _lastCollectTime > 2.4f) Combo = 1;
            if (ChasePressure >= 1f) EndRun("chase-caught");
        }

        public void BeginRun()
        {
            SessionId = Guid.NewGuid().ToString("N");
            IsRunning = true;
            CurrentSpeed = baseSpeed;
            DistanceMeters = 0;
            DurationSeconds = 0;
            ChasePressure = .15f;
            ZqCollected = 0;
            Score = 0;
            Combo = 1;
            _lastCollectTime = -99f;
            Time.timeScale = 1f;
        }

        public void CollectZq(int amount)
        {
            if (!IsRunning || amount <= 0) return;
            var chained = Time.time - _lastCollectTime <= 1.05f;
            Combo = chained ? Mathf.Min(8, Combo + 1) : 1;
            _lastCollectTime = Time.time;
            ZqCollected += amount;
            ChasePressure = Mathf.Max(0f, ChasePressure - .025f * amount);
        }

        public void RegisterCleanParkour()
        {
            if (!IsRunning) return;
            Combo = Mathf.Min(8, Combo + 1);
            Score += 150 * Combo;
            ChasePressure = Mathf.Max(0f, ChasePressure - .08f);
        }

        public void HitObstacle(float severity = .28f)
        {
            if (!IsRunning) return;
            Combo = 1;
            ChasePressure = Mathf.Clamp01(ChasePressure + Mathf.Max(.1f, severity));
            Score = Mathf.Max(0, Score - 250);
            if (ChasePressure >= .98f) EndRun("impact");
        }

        public void EndRun(string reason)
        {
            if (!IsRunning) return;
            IsRunning = false;
            CurrentSpeed = 0;
            var result = new GameRunResult
            {
                sessionId = SessionId,
                score = Score,
                zqCollected = ZqCollected,
                distanceMeters = DistanceMeters,
                durationSeconds = DurationSeconds
            };
            Debug.Log($"[Rush City] run ended: {reason}");
            ZoryqPlayBridge.ReportAndReturn(result);
        }

        void OnGUI()
        {
            // Development HUD. Production HUD is authored as final UI assets in the art pass.
            var scale = Mathf.Max(1f, Screen.width / 1080f);
            GUI.matrix = Matrix4x4.Scale(new Vector3(scale, scale, 1));
            GUI.Box(new Rect(22, 22, 300, 118), "ZORYQ PLAY / RUSH CITY");
            GUI.Label(new Rect(40, 54, 260, 28), $"DIST {DistanceMeters:0} m   SPEED {CurrentSpeed:0.0}");
            GUI.Label(new Rect(40, 82, 260, 28), $"ZQ {ZqCollected}   COMBO x{Combo}");
            GUI.Label(new Rect(40, 110, 260, 28), $"CHASE {ChasePressure * 100:0}%");
        }
    }
}
