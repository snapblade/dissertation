import cv2
import mediapipe as mp
import time
import math
from mediapipe.python.solutions.pose import PoseLandmark

mp_pose = mp.solutions.pose


# Helpers

def calculate_angle(a, b, c):
    """Angle at b between points a-b-c in degrees (using normalized coords)."""
    ax, ay = a.x, a.y
    bx, by = b.x, b.y
    cx, cy = c.x, c.y

    radians = math.atan2(cy - by, cx - bx) - math.atan2(ay - by, ax - bx)
    angle = abs(radians * 180.0 / math.pi)
    if angle > 180.0:
        angle = 360 - angle
    return angle

def get_landmark(landmarks, lm: PoseLandmark):
    return landmarks[lm.value]

def avg_visibility(*lms):
    return sum(lm.visibility for lm in lms) / len(lms)


# Draw config (keypoints & lines)

EXERCISE_KEYPOINTS = {
    "squat": [
        PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP,
        PoseLandmark.LEFT_KNEE, PoseLandmark.RIGHT_KNEE,
        PoseLandmark.LEFT_ANKLE, PoseLandmark.RIGHT_ANKLE
    ],
    "pushup": [
        PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
        PoseLandmark.LEFT_ELBOW, PoseLandmark.RIGHT_ELBOW,
        PoseLandmark.LEFT_WRIST, PoseLandmark.RIGHT_WRIST
    ],
    "plank": [
        PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
        PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP,
        PoseLandmark.LEFT_ANKLE, PoseLandmark.RIGHT_ANKLE
    ]
}

EXERCISE_CONNECTIONS = {
    "squat": [
        (PoseLandmark.LEFT_HIP, PoseLandmark.LEFT_KNEE),
        (PoseLandmark.LEFT_KNEE, PoseLandmark.LEFT_ANKLE),
        (PoseLandmark.RIGHT_HIP, PoseLandmark.RIGHT_KNEE),
        (PoseLandmark.RIGHT_KNEE, PoseLandmark.RIGHT_ANKLE),
        (PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP),
    ],
    "pushup": [
        (PoseLandmark.LEFT_SHOULDER, PoseLandmark.LEFT_ELBOW),
        (PoseLandmark.LEFT_ELBOW, PoseLandmark.LEFT_WRIST),
        (PoseLandmark.RIGHT_SHOULDER, PoseLandmark.RIGHT_ELBOW),
        (PoseLandmark.RIGHT_ELBOW, PoseLandmark.RIGHT_WRIST),
        (PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER),
    ],
    "plank": [
        (PoseLandmark.LEFT_SHOULDER, PoseLandmark.LEFT_HIP),
        (PoseLandmark.LEFT_HIP, PoseLandmark.LEFT_ANKLE),
        (PoseLandmark.RIGHT_SHOULDER, PoseLandmark.RIGHT_HIP),
        (PoseLandmark.RIGHT_HIP, PoseLandmark.RIGHT_ANKLE),
        (PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER),
        (PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP),
    ]
}


# Rep logic thresholds 

SQUAT_DOWN_ANGLE = 105   
SQUAT_UP_ANGLE   = 165   

PUSHUP_DOWN_ANGLE = 95   
PUSHUP_UP_ANGLE   = 160  

VIS_THRESH = 0.6        
CONFIRM_FRAMES = 3       


# State

current_exercise = "squat"
reps = {"squat": 0, "pushup": 0}
stage = {"squat": "up", "pushup": "up"}  # starting stage
confirm = {"squat": 0, "pushup": 0}

plank_holding = False
plank_start_time = None
plank_hold_seconds = 0.0


# Camera + Pose

cap = cv2.VideoCapture(0)

with mp_pose.Pose(
    static_image_mode=False,
    model_complexity=1,
    enable_segmentation=False,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
) as pose:
    while cap.isOpened():
        ok, frame = cap.read()
        if not ok:
            continue

        # MediaPipe inference
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(rgb)
        image = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        h, w, _ = image.shape

        feedback = "—"
        angle_text = ""

        # Draw & compute
        if results.pose_landmarks:
            landmarks = results.pose_landmarks.landmark

            # Draw selected keypoints
            for lm in EXERCISE_KEYPOINTS[current_exercise]:
                p = get_landmark(landmarks, lm)
                cx, cy = int(p.x * w), int(p.y * h)
                cv2.circle(image, (cx, cy), 6, (0, 255, 0), -1)

            # Draw selected connections
            for a, b in EXERCISE_CONNECTIONS[current_exercise]:
                pa = get_landmark(landmarks, a)
                pb = get_landmark(landmarks, b)
                x1, y1 = int(pa.x * w), int(pa.y * h)
                x2, y2 = int(pb.x * w), int(pb.y * h)
                cv2.line(image, (x1, y1), (x2, y2), (255, 255, 255), 2)

            
            # Exercise-specific logic
            
            if current_exercise == "squat":
                # Use knee angles (average left/right)
                lhip = get_landmark(landmarks, PoseLandmark.LEFT_HIP)
                lknee = get_landmark(landmarks, PoseLandmark.LEFT_KNEE)
                lankle = get_landmark(landmarks, PoseLandmark.LEFT_ANKLE)

                rhip = get_landmark(landmarks, PoseLandmark.RIGHT_HIP)
                rknee = get_landmark(landmarks, PoseLandmark.RIGHT_KNEE)
                rankle = get_landmark(landmarks, PoseLandmark.RIGHT_ANKLE)

                vis = avg_visibility(lhip, lknee, lankle, rhip, rknee, rankle)

                left_knee_angle = calculate_angle(lhip, lknee, lankle)
                right_knee_angle = calculate_angle(rhip, rknee, rankle)
                knee_angle = (left_knee_angle + right_knee_angle) / 2.0
                angle_text = f"Knee angle: {knee_angle:.0f}°"

                if vis < VIS_THRESH:
                    feedback = "Move into view / improve lighting"
                else:
                    # Determine target stage from angle
                    target = None
                    if knee_angle < SQUAT_DOWN_ANGLE:
                        target = "down"
                        feedback = "Down: good depth" if knee_angle < 95 else "Go a bit deeper"
                    elif knee_angle > SQUAT_UP_ANGLE:
                        target = "up"
                        feedback = "Up: looks good"

                    # Debounced stage transition + rep count
                    if target and target != stage["squat"]:
                        confirm["squat"] += 1
                        if confirm["squat"] >= CONFIRM_FRAMES:
                            # Rep counts when you go from down -> up
                            if stage["squat"] == "down" and target == "up":
                                reps["squat"] += 1
                            stage["squat"] = target
                            confirm["squat"] = 0
                    else:
                        confirm["squat"] = 0

            elif current_exercise == "pushup":
                # Use elbow angles (average left/right)
                lsh = get_landmark(landmarks, PoseLandmark.LEFT_SHOULDER)
                lel = get_landmark(landmarks, PoseLandmark.LEFT_ELBOW)
                lwr = get_landmark(landmarks, PoseLandmark.LEFT_WRIST)

                rsh = get_landmark(landmarks, PoseLandmark.RIGHT_SHOULDER)
                rel = get_landmark(landmarks, PoseLandmark.RIGHT_ELBOW)
                rwr = get_landmark(landmarks, PoseLandmark.RIGHT_WRIST)

                vis = avg_visibility(lsh, lel, lwr, rsh, rel, rwr)

                left_elbow_angle = calculate_angle(lsh, lel, lwr)
                right_elbow_angle = calculate_angle(rsh, rel, rwr)
                elbow_angle = (left_elbow_angle + right_elbow_angle) / 2.0
                angle_text = f"Elbow angle: {elbow_angle:.0f}°"

                if vis < VIS_THRESH:
                    feedback = "Move into view / improve lighting"
                else:
                    target = None
                    if elbow_angle < PUSHUP_DOWN_ANGLE:
                        target = "down"
                        feedback = "Down: nice control" if elbow_angle < 85 else "Go lower"
                    elif elbow_angle > PUSHUP_UP_ANGLE:
                        target = "up"
                        feedback = "Up: good press"

                    if target and target != stage["pushup"]:
                        confirm["pushup"] += 1
                        if confirm["pushup"] >= CONFIRM_FRAMES:
                            if stage["pushup"] == "down" and target == "up":
                                reps["pushup"] += 1
                            stage["pushup"] = target
                            confirm["pushup"] = 0
                    else:
                        confirm["pushup"] = 0

            elif current_exercise == "plank":
                # Hold timer + quick posture check using shoulder-hip-ankle angle
                lsh = get_landmark(landmarks, PoseLandmark.LEFT_SHOULDER)
                lhip = get_landmark(landmarks, PoseLandmark.LEFT_HIP)
                lank = get_landmark(landmarks, PoseLandmark.LEFT_ANKLE)

                rsh = get_landmark(landmarks, PoseLandmark.RIGHT_SHOULDER)
                rhip = get_landmark(landmarks, PoseLandmark.RIGHT_HIP)
                rank = get_landmark(landmarks, PoseLandmark.RIGHT_ANKLE)

                vis = avg_visibility(lsh, lhip, lank, rsh, rhip, rank)

                left_line = calculate_angle(lsh, lhip, lank)
                right_line = calculate_angle(rsh, rhip, rank)
                body_line = (left_line + right_line) / 2.0
                angle_text = f"Body line: {body_line:.0f}°"

                if vis < VIS_THRESH:
                    feedback = "Move into view / improve lighting"
                    plank_holding = False
                    plank_start_time = None
                else:
                    # Rough heuristic: 170-180 is straighter; smaller -> hip sag/pike
                    if body_line > 165:
                        feedback = "Plank: solid line"
                        if not plank_holding:
                            plank_holding = True
                            plank_start_time = time.time()
                        plank_hold_seconds = time.time() - plank_start_time
                    elif 150 <= body_line <= 165:
                        feedback = "Adjust hips slightly"
                        plank_holding = False
                        plank_start_time = None
                        plank_hold_seconds = 0.0
                    else:
                        feedback = "Fix form: hips too low/high"
                        plank_holding = False
                        plank_start_time = None
                        plank_hold_seconds = 0.0


        # UI Overlay

        cv2.putText(image, f"Exercise: {current_exercise.upper()}   (1=Squat, 2=Pushup, 3=Plank, R=Reset)",
                    (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)

        if current_exercise in ("squat", "pushup"):
            cv2.putText(image, f"Reps: {reps[current_exercise]}   Stage: {stage[current_exercise].upper()}",
                        (20, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
        else:
            cv2.putText(image, f"Hold: {plank_hold_seconds:.1f}s",
                        (20, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

        if angle_text:
            cv2.putText(image, angle_text, (20, 105),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

        cv2.putText(image, f"Feedback: {feedback}", (20, 140),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

        cv2.imshow("Dynamic Pose + Reps", image)


        # Controls

        key = cv2.waitKey(5) & 0xFF
        if key == 27:  # ESC
            break
        elif key == ord('1'):
            current_exercise = "squat"
        elif key == ord('2'):
            current_exercise = "pushup"
        elif key == ord('3'):
            current_exercise = "plank"
        elif key in (ord('r'), ord('R')):
            reps["squat"] = 0
            reps["pushup"] = 0
            stage["squat"] = "up"
            stage["pushup"] = "up"
            confirm["squat"] = 0
            confirm["pushup"] = 0
            plank_holding = False
            plank_start_time = None
            plank_hold_seconds = 0.0

cap.release()
cv2.destroyAllWindows()
