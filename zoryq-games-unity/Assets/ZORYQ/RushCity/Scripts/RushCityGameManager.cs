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
        [SerializeField] float maxSpeed = 32f;
        [SerializeField] float speedGainPerSecond = 0.16f;
        [SerializeField] float chasePressureGain = 0.018f;
        [SerializeField] float chasePressureRecovery = 0.11f;

        public bool IsRunning { get; private set; }
        public float CurrentSpeed { get; private set; }
        public float DistanceMeters { get; private set; }
        public float DurationSeconds { get; private set; }
        public float ChasePressure { get; private set; }
        public float SkillFlow { get; private set; }
        public int ZqCollected { get; private set; }
        public int Score { get; private set; }
        public int Combo { get; private set; } = 1;
        public string SessionId { get; private set; }
        public bool MagnetActive => _magnetUntil > Time.time;
        public bool ShieldActive => _shieldCharges > 0;
        public bool OverdriveActive => _overdriveUntil > Time.time;
        public int ScoreMultiplier => _multiplierUntil > Time.time ? 2 : 1;
        public float MagnetSeconds => Mathf.Max(0f,_magnetUntil-Time.time);
        public float OverdriveSeconds => Mathf.Max(0f,_overdriveUntil-Time.time);
        public float MultiplierSeconds => Mathf.Max(0f,_multiplierUntil-Time.time);
        public int ShieldCharges => _shieldCharges;
        public int TotalZq => ZqCollected + _bonusZq;

        float _lastCollectTime, _magnetUntil, _overdriveUntil, _multiplierUntil;
        int _shieldCharges, _bonusScore, _bonusZq;

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

            var flowPace = Mathf.Lerp(.85f, 1.18f, SkillFlow);
            var overdrive = OverdriveActive ? 1.22f : 1f;
            var rawSpeed = Mathf.Min(maxSpeed * overdrive, (baseSpeed + DurationSeconds * speedGainPerSecond * flowPace) * overdrive);
            var liveSpeed = RushCityLiveOpsConfig.Instance ? RushCityLiveOpsConfig.Instance.Speed(rawSpeed) : rawSpeed;
            var eventSpeed = RushCityWorldEventDirector.Instance ? RushCityWorldEventDirector.Instance.SpeedMultiplier : 1f;
            CurrentSpeed = liveSpeed * eventSpeed;
            DistanceMeters += CurrentSpeed * Time.deltaTime;

            var baseScore = Mathf.RoundToInt(DistanceMeters * 10f) + ZqCollected * 25 * Combo + _bonusScore;
            var dangerBonus = Mathf.RoundToInt(ChasePressure * 200f * Mathf.Max(1, Combo));
            var calculated = (baseScore + dangerBonus) * ScoreMultiplier;
            calculated = RushCityLiveOpsConfig.Instance ? RushCityLiveOpsConfig.Instance.Score(calculated) : calculated;
            var eventScore = RushCityWorldEventDirector.Instance ? RushCityWorldEventDirector.Instance.ScoreMultiplier : 1f;
            calculated = Mathf.RoundToInt(calculated * eventScore);
            Score = Mathf.Max(Score, calculated);

            var rawChaseGain=chasePressureGain * Mathf.Lerp(1.08f,.82f,SkillFlow);
            var liveChase=RushCityLiveOpsConfig.Instance ? RushCityLiveOpsConfig.Instance.Chase(rawChaseGain) : rawChaseGain;
            var eventChase=RushCityWorldEventDirector.Instance ? RushCityWorldEventDirector.Instance.ChaseMultiplier : 1f;
            ChasePressure = Mathf.Clamp01(ChasePressure + liveChase * eventChase * Time.deltaTime);
            if (Time.time - _lastCollectTime < 0.75f) ChasePressure = Mathf.Clamp01(ChasePressure - chasePressureRecovery * Time.deltaTime);

            if (Time.time - _lastCollectTime > 2.4f) Combo = 1;
            RushCityMissionDirector.Instance?.OnDistance(DistanceMeters);
            RushCityMissionDirector.Instance?.OnSurvival(DurationSeconds);
            if (ChasePressure >= 1f) EndRun("chase-caught");
        }

        public void BeginRun()
        {
            SessionId = Guid.NewGuid().ToString("N");
            IsRunning = true; CurrentSpeed = baseSpeed; DistanceMeters = 0; DurationSeconds = 0; ChasePressure = .15f; SkillFlow = .25f;
            ZqCollected = 0; Score = 0; Combo = 1; _bonusScore = 0; _bonusZq = 0; _shieldCharges = 0;
            _magnetUntil = _overdriveUntil = _multiplierUntil = -1f; _lastCollectTime = -99f; Time.timeScale = 1f;
            RushCityGhostRecorder.Instance?.ResetRecording();
            RushCityMissionDirector.Instance?.BeginSession(SessionId);
        }

        public void CollectZq(int amount)
        {
            if (!IsRunning || amount <= 0) return;
            var chained = Time.time - _lastCollectTime <= 1.05f;
            Combo = chained ? Mathf.Min(10, Combo + 1) : 1; _lastCollectTime = Time.time; ZqCollected += amount;
            SkillFlow = Mathf.Clamp01(SkillFlow + .008f * amount); ChasePressure = Mathf.Max(0f, ChasePressure - .025f * amount);
            RushCityMissionDirector.Instance?.OnZq(amount);
            RushCityGameEvents.RaiseZq(amount,Combo);
        }

        public void RegisterCleanParkour()
        {
            if (!IsRunning) return;
            Combo = Mathf.Min(10, Combo + 1); SkillFlow = Mathf.Clamp01(SkillFlow + .055f);
            Score += 150 * Combo * ScoreMultiplier; ChasePressure = Mathf.Max(0f, ChasePressure - .08f);
            RushCityMissionDirector.Instance?.OnParkour();
        }

        public void RegisterNearMiss()
        {
            if (!IsRunning) return;
            Combo = Mathf.Min(10, Combo + 1); SkillFlow = Mathf.Clamp01(SkillFlow + .035f);
            Score += 220 * Combo * ScoreMultiplier; ChasePressure = Mathf.Max(0f, ChasePressure - .045f);
            RushCityMissionDirector.Instance?.OnNearMiss(); RushCityTelemetry.Instance?.NearMiss();
            RushCityGameEvents.RaiseNearMiss();
        }

        public void RegisterRouteChoice(int direction,string district)
        {
            if(!IsRunning)return;
            Combo=Mathf.Min(10,Combo+1);
            SkillFlow=Mathf.Clamp01(SkillFlow+.04f);
            Score+=300*Combo*ScoreMultiplier;
            ChasePressure=Mathf.Max(0f,ChasePressure-.035f);
            RushCityGameEvents.RaiseRoute(direction,district);
            Debug.Log($"[Rush City] route branch={(direction<0?"LEFT":"RIGHT")} district={district}");
        }

        public void HitObstacle(float severity = .28f)
        {
            if (!IsRunning) return;
            if (TryConsumeShield()) { ChasePressure = Mathf.Max(0f, ChasePressure - .05f); RushCityGameEvents.RaiseImpact(severity*.25f); return; }
            Combo = 1; SkillFlow = Mathf.Clamp01(SkillFlow - .18f);
            ChasePressure = Mathf.Clamp01(ChasePressure + Mathf.Max(.1f, severity)); Score = Mathf.Max(0, Score - 250);
            RushCityTelemetry.Instance?.Hit(); RushCityGameEvents.RaiseImpact(severity);
            if (ChasePressure >= .98f) EndRun("impact");
        }

        public void ActivatePowerUp(RushPowerUpType type, float duration)
        {
            if (!IsRunning) return;
            duration = Mathf.Clamp(duration, 3f, 18f);
            switch(type)
            {
                case RushPowerUpType.Magnet: _magnetUntil = Mathf.Max(_magnetUntil,Time.time+duration); break;
                case RushPowerUpType.Shield: _shieldCharges = Mathf.Min(3,_shieldCharges+1); break;
                case RushPowerUpType.Overdrive: _overdriveUntil = Mathf.Max(_overdriveUntil,Time.time+duration); break;
                case RushPowerUpType.Multiplier: _multiplierUntil = Mathf.Max(_multiplierUntil,Time.time+duration); break;
            }
            Score += 180;
            RushCityGameEvents.RaisePowerUp(type,duration);
        }

        public bool TryConsumeShield(){if (_shieldCharges <= 0) return false; _shieldCharges--; return true;}

        public void GrantMissionReward(int rewardScore,int rewardZq,string mission)
        {
            if(!IsRunning)return;
            _bonusScore += Mathf.Max(0,rewardScore); _bonusZq += Mathf.Max(0,rewardZq); Score += Mathf.Max(0,rewardScore);
            RushCityGameEvents.RaiseMission(rewardScore,rewardZq,mission);
            Debug.Log($"[Rush City] mission complete {mission}: +{rewardScore} score +{rewardZq} ZQ");
        }

        public void GrantWorldEventReward(int rewardScore,int rewardZq,string eventName)
        {
            if(!IsRunning)return;
            var eventType=RushWorldEvent.None;
            Enum.TryParse(eventName,true,out eventType);
            var score=Mathf.Max(0,rewardScore);
            var zq=Mathf.Max(0,rewardZq);
            _bonusScore+=score;
            _bonusZq+=zq;
            Score+=score;
            SkillFlow=Mathf.Clamp01(SkillFlow+.08f);
            ChasePressure=Mathf.Max(0f,ChasePressure-.12f);
            RushCityGameEvents.RaiseWorldEventReward(eventType,score,zq);
            Debug.Log($"[Rush City] world event reward {eventName}: +{score} score +{zq} ZQ");
        }

        public void EndRun(string reason)
        {
            if (!IsRunning) return;
            IsRunning = false; CurrentSpeed = 0;
            var result = new GameRunResult { sessionId = SessionId, score = Score, zqCollected = TotalZq, distanceMeters = DistanceMeters, durationSeconds = DurationSeconds };
            RushCityGhostRaceManager.Instance?.FinishAndStoreCurrentRun();
            RushCityGameEvents.RaiseRunEnded(reason);
            Debug.Log($"[Rush City] run ended: {reason} telemetry={RushCityTelemetry.Instance?.SnapshotJson()}");
            ZoryqPlayBridge.ReportAndReturn(result);
        }

#if UNITY_EDITOR || DEVELOPMENT_BUILD
        void OnGUI()
        {
            var scale = Mathf.Max(1f, Screen.width / 1080f); GUI.matrix = Matrix4x4.Scale(new Vector3(scale, scale, 1));
            GUI.Box(new Rect(22, 22, 390, 230), "ZORYQ PLAY / RUSH CITY DEV HUD");
            GUI.Label(new Rect(40, 54, 355, 28), $"DIST {DistanceMeters:0}m  SPEED {CurrentSpeed:0.0}");
            GUI.Label(new Rect(40, 82, 355, 28), $"ZQ {TotalZq}  COMBO x{Combo}  SCORE x{ScoreMultiplier}");
            GUI.Label(new Rect(40, 110, 355, 28), $"CHASE {ChasePressure * 100:0}%  FLOW {SkillFlow * 100:0}%");
            GUI.Label(new Rect(40, 138, 355, 28), $"MAG {(MagnetActive?"ON":"-")} SHIELD {_shieldCharges} BOOST {(OverdriveActive?"ON":"-")}");
            if(RushCityLiveOpsConfig.Instance)GUI.Label(new Rect(40,166,355,28),$"SEASON {RushCityLiveOpsConfig.Instance.Current.seasonId}");
            if(RushCityRouteDirector.Instance)GUI.Label(new Rect(40,194,355,28),$"DISTRICT {RushCityRouteDirector.Instance.District} BRANCH {RushCityRouteDirector.Instance.BranchCount}");
            if(RushCityWorldEventDirector.Instance)GUI.Label(new Rect(40,222,355,28),$"EVENT {RushCityWorldEventDirector.Instance.ActiveEvent} INT {RushCityWorldEventDirector.Instance.Intensity:0.00}");
        }
#endif
    }
}
