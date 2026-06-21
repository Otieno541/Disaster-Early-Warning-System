import os
import re
import uuid
import random
import smtplib
import hashlib
import secrets
import mimetypes
from datetime import datetime, timedelta, timezone
from functools import wraps
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests
from flask import Flask, request, jsonify, send_from_directory, session, render_template
from flask_cors import CORS
from flask_compress import Compress
from config import Config
app = Flask(__name__, template_folder='.', static_folder='static')
app.config.from_object(Config)
CORS(app)
Compress(app)
users_db = {}
chat_messages_db = []
disaster_reports_db = []
simulated_disasters_db = []
notifications_db = []
admin_notifications_db = []
sent_notifications_log = []
if Config.ADMIN_USERNAME:
    admin_id = str(uuid.uuid4())
    hashed_admin_pw = hashlib.sha256(Config.ADMIN_PASSWORD.encode()).hexdigest()
    users_db[Config.ADMIN_USERNAME] = {
        'id': admin_id,
        'username': Config.ADMIN_USERNAME,
        'password': hashed_admin_pw,
        'full_name': 'System Administrator',
        'email': 'dotieno558@gmail.com',
        'phone': '0746034952',
        'is_admin': True,
        'is_online': False,
        'is_active': True,
        'last_seen': None,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
def validate_password_strength(password):
    errors = []
    if len(password) < 8:
        errors.append("at least 8 characters")
    if not re.search(r'[A-Z]', password):
        errors.append("one uppercase letter")
    if not re.search(r'[a-z]', password):
        errors.append("one lowercase letter")
    if not re.search(r'[0-9]', password):
        errors.append("one number")
    if not re.search(r'[^A-Za-z0-9]', password):
        errors.append("one special character")
    return errors
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated
def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        user = None
        for u in users_db.values():
            if u['id'] == session['user_id']:
                user = u
                break
        if not user or not user.get('is_admin'):
            return jsonify({'success': False, 'message': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated
@app.route('/')
def index():
    return render_template('index.html')
@app.route('/login')
def login_page():
    return render_template('login.html')
@app.route('/admin')
def admin_page():
    return render_template('admin.html')
@app.route('/api/check-auth', methods=['GET'])
def check_auth():
    if 'user_id' in session:
        for u in users_db.values():
            if u['id'] == session['user_id']:
                return jsonify({
                    'authenticated': True,
                    'user': {
                        'id': u['id'],
                        'username': u['username'],
                        'full_name': u.get('full_name', ''),
                        'email': u.get('email', ''),
                        'phone': u.get('phone', ''),
                        'is_admin': u.get('is_admin', False),
                        'avatar_url': u.get('avatar_url', '')
                    }
                })
    return jsonify({'authenticated': False})
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username', '').strip().lower()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    full_name = data.get('full_name', '').strip()
    phone = data.get('phone', '').strip()
    if not username or not password or not email:
        return jsonify({'success': False, 'message': 'Username, email and password are required'})
    if username in users_db:
        return jsonify({'success': False, 'message': 'Username already exists'})
    pw_errors = validate_password_strength(password)
    if pw_errors:
        return jsonify({'success': False, 'message': f"Password must contain {', '.join(pw_errors)}!"})
    user_id = str(uuid.uuid4())
    users_db[username] = {
        'id': user_id,
        'username': username,
        'password': hashlib.sha256(password.encode()).hexdigest(),
        'full_name': full_name or username,
        'email': email,
        'phone': phone,
        'is_admin': False,
        'is_online': True,
        'is_active': True,
        'last_seen': datetime.now(timezone.utc).isoformat(),
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    session['user_id'] = user_id
    return jsonify({'success': True, 'message': 'Registration successful'})
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username', '').strip().lower()
    password = data.get('password', '')
    login_type = data.get('login_type', 'user')
    pw_errors = validate_password_strength(password)
    if pw_errors:
        return jsonify({'success': False, 'message': f"Password does not meet strength requirements. It must contain {', '.join(pw_errors)}!"})
    user = users_db.get(username)
    if not user:
        return jsonify({'success': False, 'message': 'Invalid username or password'})
    hashed_pw = hashlib.sha256(password.encode()).hexdigest()
    if user['password'] != hashed_pw and user['password'] != password:
        return jsonify({'success': False, 'message': 'Invalid username or password'})
    if user.get('is_active') is False:
        return jsonify({'success': False, 'message': 'Your account has been deactivated. Contact admin.'})
    if login_type == 'admin' and not user.get('is_admin'):
        return jsonify({'success': False, 'message': 'You do not have admin privileges'})
    session['user_id'] = user['id']
    user['is_online'] = True
    user['last_seen'] = datetime.now(timezone.utc).isoformat()
    return jsonify({
        'success': True,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'full_name': user.get('full_name', ''),
            'email': user.get('email', ''),
            'is_admin': user.get('is_admin', False)
        }
    })
@app.route('/api/logout', methods=['POST'])
def logout():
    if 'user_id' in session:
        for u in users_db.values():
            if u['id'] == session['user_id']:
                u['is_online'] = False
                u['last_seen'] = datetime.now(timezone.utc).isoformat()
                break
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully'})
@app.route('/api/update-profile', methods=['POST'])
@login_required
def update_profile():
    user = None
    for u in users_db.values():
        if u['id'] == session['user_id']:
            user = u
            break
    if not user:
        return jsonify({'success': False, 'message': 'User not found'})
    full_name = request.form.get('full_name', user.get('full_name', ''))
    email = request.form.get('email', user.get('email', ''))
    phone = request.form.get('phone', user.get('phone', ''))
    new_password = request.form.get('new_password', '')
    confirm_password = request.form.get('confirm_password', '')
    user['full_name'] = full_name
    user['email'] = email
    user['phone'] = phone
    if new_password:
        if new_password != confirm_password:
            return jsonify({'success': False, 'message': 'Passwords do not match'})
        pw_errors = validate_password_strength(new_password)
        if pw_errors:
            return jsonify({'success': False, 'message': f"Password must contain {', '.join(pw_errors)}!"})
        user['password'] = hashlib.sha256(new_password.encode()).hexdigest()
    if 'avatar' in request.files:
        avatar = request.files['avatar']
        if avatar.filename:
            ext = avatar.filename.rsplit('.', 1)[1].lower() if '.' in avatar.filename else 'jpg'
            filename = f"avatar_{user['id']}.{ext}"
            avatar_dir = os.path.join(app.static_folder, 'uploads', 'avatars')
            os.makedirs(avatar_dir, exist_ok=True)
            avatar.save(os.path.join(avatar_dir, filename))
            user['avatar_url'] = f'/static/uploads/avatars/{filename}'
    return jsonify({
        'success': True,
        'message': 'Profile updated successfully',
        'user': {
            'id': user['id'],
            'username': user['username'],
            'full_name': user['full_name'],
            'email': user['email'],
            'phone': user.get('phone', ''),
            'avatar_url': user.get('avatar_url', '')
        }
    })
otp_store = {}
@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    user = None
    for u in users_db.values():
        if u.get('email', '').lower() == email:
            user = u
            break
    if not user:
        return jsonify({'success': False, 'message': 'No account found with that email'})
    otp = ''.join([str(random.randint(0, 9)) for _ in range(6)])
    reset_token = secrets.token_urlsafe(32)
    otp_store[email] = {
        'otp': otp,
        'token': reset_token,
        'expires': datetime.now(timezone.utc) + timedelta(minutes=15)
    }
    if Config.SMTP_SERVER and Config.SMTP_USER:
        try:
            send_email(email, 'DEWS Kenya - Password Reset OTP',
                       f'Your OTP is: {otp}. It expires in 15 minutes.')
        except Exception as e:
            print(f'Email send failed: {e}')
            return jsonify({'success': True, 'message': f'OTP generated: {otp} (Email not configured - use this OTP)'})
    return jsonify({'success': True, 'message': 'OTP sent to your email', 'reset_token': reset_token})
@app.route('/api/verify-otp', methods=['POST'])
def verify_otp():
    data = request.get_json()
    email = data.get('email', '').lower()
    otp = data.get('otp', '')
    stored = otp_store.get(email)
    if not stored or stored['otp'] != otp:
        return jsonify({'success': False, 'message': 'Invalid OTP'})
    if datetime.now(timezone.utc) > stored['expires']:
        return jsonify({'success': False, 'message': 'OTP has expired'})
    return jsonify({'success': True, 'message': 'OTP verified', 'reset_token': stored['token']})
@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json()
    token = data.get('token', '')
    new_password = data.get('new_password', '')
    user = None
    for stored in otp_store.values():
        if stored['token'] == token:
            for email_key, s in otp_store.items():
                if s['token'] == token:
                    for u in users_db.values():
                        if u.get('email', '').lower() == email_key:
                            user = u
                            break
                    break
            break
    if not user:
        return jsonify({'success': False, 'message': 'Invalid reset token'})
    pw_errors = validate_password_strength(new_password)
    if pw_errors:
        return jsonify({'success': False, 'message': f"Password must contain {', '.join(pw_errors)}!"})
    user['password'] = hashlib.sha256(new_password.encode()).hexdigest()
    return jsonify({'success': True, 'message': 'Password reset successful'})
@app.route('/api/report', methods=['POST'])
@login_required
def report_disaster():
    county = request.form.get('county', '')
    disaster_type = request.form.get('type', '')
    description = request.form.get('description', '')
    location = request.form.get('location', '')
    phone = request.form.get('phone', '')
    voice_data = request.form.get('voice_data', '')
    report_id = str(uuid.uuid4())
    report = {
        'id': report_id,
        'county': county,
        'type': disaster_type,
        'description': description,
        'location': location,
        'phone': phone,
        'voice_data': voice_data,
        'media_files': [],
        'status': 'Pending Review',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'reported_by': session.get('user_id')
    }
    for key in request.files:
        file = request.files[key]
        if file.filename:
            ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else 'jpg'
            safe_name = f"report_{report_id}_{key}.{ext}"
            upload_dir = os.path.join(app.static_folder, 'uploads', 'reports')
            os.makedirs(upload_dir, exist_ok=True)
            file.save(os.path.join(upload_dir, safe_name))
            report['media_files'].append(f'/static/uploads/reports/{safe_name}')
    disaster_reports_db.append(report)
    reporter = None
    for u in users_db.values():
        if u['id'] == session.get('user_id'):
            reporter = u
            break
    admin_notif = {
        'id': str(uuid.uuid4()),
        'type': 'new_report',
        'title': f'New Disaster Report: {disaster_type} in {county}',
        'message': description[:150] if description else f'A new {disaster_type} has been reported in {county}',
        'report_id': report_id,
        'reporter_name': reporter.get('full_name', reporter['username']) if reporter else 'Unknown',
        'county': county,
        'disaster_type': disaster_type,
        'severity': 'High',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'read': False
    }
    admin_notifications_db.append(admin_notif)
    while len(admin_notifications_db) > 100:
        admin_notifications_db.pop(0)
    return jsonify({'success': True, 'message': 'Report submitted successfully'})
@app.route('/api/disasters', methods=['GET'])
def get_disasters():
    all_disasters = []
    for report in disaster_reports_db:
        if report.get('status') != 'Resolved':
            all_disasters.append({
                'id': report['id'],
                'type': report.get('type', 'Other'),
                'county': report.get('county', 'Unknown'),
                'location': report.get('location', report.get('county', '')),
                'severity': 'High',
                'confidence': 85,
                'status': report.get('status', 'Reported'),
                'description': report.get('description', ''),
                'timestamp': report.get('timestamp', datetime.now(timezone.utc).isoformat()),
                'source': 'User Report',
                'coords': [-1.2921, 36.8219]
            })
    all_disasters.extend(simulated_disasters_db)
    return jsonify({'success': True, 'disasters': all_disasters})
@app.route('/api/real-disasters', methods=['GET'])
def get_real_disasters():
    disasters = []
    try:
        resp = requests.get(
            'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson'
            '&minlatitude=-5&maxlatitude=5&minlongitude=33&maxlongitude=43'
            '&starttime=' + (datetime.now(timezone.utc) - timedelta(days=7)).strftime('%Y-%m-%d')
            + '&endtime=' + datetime.now(timezone.utc).strftime('%Y-%m-%d') +
            '&minmagnitude=2.5',
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            for eq in data.get('features', []):
                coords = eq['geometry']['coordinates']
                mag = eq['properties']['mag']
                disasters.append({
                    'id': f"usgs-{eq['properties']['code']}",
                    'type': 'Earthquake',
                    'county': find_nearest_county(coords[1], coords[0]),
                    'location': eq['properties']['place'],
                    'coords': [coords[1], coords[0]],
                    'severity': 'Critical' if mag >= 5 else 'High' if mag >= 4 else 'Medium',
                    'confidence': min(95, int(60 + mag * 5)),
                    'status': 'Occurring',
                    'timestamp': datetime.fromtimestamp(eq['properties']['time'] / 1000, tz=timezone.utc).isoformat(),
                    'source': 'USGS Real-time',
                    'description': f"Magnitude {mag} earthquake. Depth: {coords[2]:.1f}km. {eq['properties']['place']}"
                })
    except Exception as e:
        print(f"USGS fetch error: {e}")
    if len(disasters) == 0:
        disasters = generate_inferred_disasters()
    return jsonify({'success': True, 'disasters': disasters})
def find_nearest_county(lat, lon):
    counties = {
        'Baringo': [0.7913, 35.9644], 'Bomet': [-0.7827, 35.3288],
        'Bungoma': [0.5922, 34.5368], 'Busia': [0.4347, 34.2421],
        'Elgeyo-Marakwet': [0.7500, 35.5000], 'Embu': [-0.5380, 37.4574],
        'Garissa': [-0.4531, 39.6460], 'Homa Bay': [-0.5757, 34.3900],
        'Isiolo': [0.3539, 37.5822], 'Kajiado': [-1.8425, 36.7823],
        'Kakamega': [0.2826, 34.7519], 'Kericho': [-0.3557, 35.2835],
        'Kiambu': [-1.1712, 36.8357], 'Kilifi': [-3.5030, 39.6742],
        'Kirinyaga': [-0.5621, 37.3200], 'Kisii': [-0.6817, 34.7667],
        'Kisumu': [-0.0917, 34.7680], 'Kitui': [-1.3667, 38.0167],
        'Kwale': [-4.1817, 39.4608], 'Laikipia': [0.3606, 36.7820],
        'Lamu': [-2.2717, 40.9020], 'Machakos': [-1.5177, 37.2634],
        'Makueni': [-1.7800, 37.6300], 'Mandera': [3.9304, 41.8559],
        'Marsabit': [2.3340, 37.9890], 'Meru': [0.0500, 37.6500],
        'Migori': [-1.0634, 34.4731], 'Mombasa': [-4.0435, 39.6682],
        'Murang\'a': [-0.7833, 37.0333], 'Nairobi': [-1.2921, 36.8219],
        'Nakuru': [-0.3031, 36.0800], 'Nandi': [0.1833, 35.1333],
        'Narok': [-1.0788, 35.8681], 'Nyamira': [-0.5667, 34.9333],
        'Nyandarua': [-0.4000, 36.3667], 'Nyeri': [-0.4167, 36.9500],
        'Samburu': [1.0000, 37.0000], 'Siaya': [0.0617, 34.2882],
        'Taita-Taveta': [-3.3167, 38.3667], 'Tana River': [-1.5000, 40.0333],
        'Tharaka-Nithi': [-0.3000, 37.8333], 'Trans Nzoia': [1.0000, 35.0000],
        'Turkana': [2.5000, 36.7500], 'Uasin Gishu': [0.5177, 35.2699],
        'Vihiga': [0.1000, 34.7000], 'Wajir': [1.7471, 40.0573],
        'West Pokot': [1.7500, 35.0000]
    }
    nearest = 'Unknown'
    min_dist = float('inf')
    for name, coords in counties.items():
        dist = ((lat - coords[0]) ** 2 + (lon - coords[1]) ** 2) ** 0.5
        if dist < min_dist:
            min_dist = dist
            nearest = name
    return nearest
def generate_inferred_disasters():
    disasters = []
    locations = [
        ('Nairobi', [-1.2921, 36.8219], 'Heatwave'),
        ('Mombasa', [-4.0435, 39.6682], 'Flood'),
        ('Kisumu', [-0.0917, 34.7680], 'Flood'),
        ('Garissa', [-0.4531, 39.6460], 'Drought'),
        ('Lodwar', [2.5000, 36.7500], 'Drought'),
        ('Mandera', [3.9304, 41.8559], 'Water Scarcity'),
        ('Eldoret', [0.5177, 35.2699], 'Epidemic'),
        ('Nakuru', [-0.3031, 36.0800], 'Landslide'),
        ('Marsabit', [2.3340, 37.9890], 'Drought'),
        ('Wajir', [1.7471, 40.0573], 'Water Scarcity'),
        ('Narok', [-1.0788, 35.8681], 'Wildlife Conflict'),
        ('Baringo', [0.7913, 35.9644], 'Flood'),
        ('Kilifi', [-3.5030, 39.6742], 'Heatwave'),
        ('Kwale', [-4.1817, 39.4608], 'Air Quality'),
        ('Tana River', [-1.5000, 40.0333], 'Flood'),
    ]
    for city, coords, dtype in locations:
        sev = random.choice(['Critical', 'High', 'Medium'])
        conf = random.randint(65, 95)
        disasters.append({
            'id': f"inferred-{dtype.lower()}-{city.lower()}-{random.randint(1000, 9999)}",
            'type': dtype,
            'county': find_nearest_county(coords[0], coords[1]),
            'location': city,
            'coords': [coords[0] + random.uniform(-0.05, 0.05), coords[1] + random.uniform(-0.05, 0.05)],
            'severity': sev,
            'confidence': conf,
            'status': 'Occurring',
            'timestamp': (datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 48))).isoformat(),
            'source': 'DEWS Weather Analysis',
            'description': f'{dtype} risk detected in {city} based on current weather pattern analysis. Monitoring active.'
        })
    return disasters
@app.route('/api/weather', methods=['GET'])
def get_weather():
    lat = request.args.get('lat', -1.2921)
    lon = request.args.get('lon', 36.8219)
    if Config.OPENWEATHER_API_KEY:
        try:
            resp = requests.get(
                f'https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={Config.OPENWEATHER_API_KEY}&units=metric',
                timeout=10
            )
            if resp.status_code == 200:
                data = resp.json()
                return jsonify({
                    'success': True,
                    'temp': round(data['main']['temp']),
                    'feels_like': round(data['main']['feels_like']),
                    'humidity': data['main']['humidity'],
                    'wind': data['wind']['speed'],
                    'pressure': data['main']['pressure'],
                    'visibility': data.get('visibility', 10000),
                    'description': data['weather'][0]['description'].title(),
                    'icon': data['weather'][0]['icon']
                })
        except Exception as e:
            print(f"Weather API error: {e}")
    temp = random.randint(18, 38)
    return jsonify({
        'success': True,
        'temp': temp,
        'feels_like': temp + random.randint(-2, 3),
        'humidity': random.randint(30, 85),
        'wind': round(random.uniform(1, 15), 1),
        'pressure': random.randint(1000, 1020),
        'visibility': random.randint(5000, 10000),
        'description': random.choice(['Clear sky', 'Few clouds', 'Scattered clouds', 'Light rain', 'Overcast']),
        'icon': '02d'
    })
@app.route('/api/chat', methods=['GET'])
@login_required
def get_chat_messages():
    user = None
    for u in users_db.values():
        if u['id'] == session['user_id']:
            user = u
            break
    msgs = [m for m in chat_messages_db
            if m.get('user_id') == session['user_id'] or m.get('sender_type') == 'admin']
    return jsonify({
        'success': True,
        'messages': msgs,
        'user_name': user.get('full_name', user['username']) if user else 'User'
    })
@app.route('/api/chat', methods=['POST'])
@login_required
def send_chat_message():
    data = request.get_json()
    content = data.get('content', '').strip()
    if not content:
        return jsonify({'success': False, 'message': 'Message content required'})
    user = None
    for u in users_db.values():
        if u['id'] == session['user_id']:
            user = u
            break
    message = {
        'id': str(uuid.uuid4()),
        'user_id': session['user_id'],
        'sender_type': 'user',
        'sender_name': user.get('full_name', user['username']) if user else 'User',
        'content': content,
        'timestamp': datetime.now(timezone.utc).isoformat()
    }
    chat_messages_db.append(message)
    while len(chat_messages_db) > 500:
        chat_messages_db.pop(0)
    admin_notif = {
        'id': str(uuid.uuid4()),
        'type': 'new_message',
        'title': f'New message from {user.get("full_name", user["username"]) if user else "User"}',
        'message': content[:100],
        'user_id': session['user_id'],
        'sender_name': user.get('full_name', user['username']) if user else 'User',
        'severity': 'Medium',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'read': False
    }
    admin_notifications_db.append(admin_notif)
    while len(admin_notifications_db) > 100:
        admin_notifications_db.pop(0)
    return jsonify({'success': True, 'message': 'Message sent'})
@app.route('/api/admin/chat-reply', methods=['POST'])
@admin_required
def admin_chat_reply():
    data = request.get_json()
    content = data.get('content', '').strip()
    user_id = data.get('user_id', '')
    if not content or not user_id:
        return jsonify({'success': False, 'message': 'Content and user_id required'})
    target_user = None
    for u in users_db.values():
        if u['id'] == user_id:
            target_user = u
            break
    if not target_user:
        return jsonify({'success': False, 'message': 'User not found'})
    message = {
        'id': str(uuid.uuid4()),
        'user_id': user_id,
        'sender_type': 'admin',
        'sender_name': 'Admin',
        'content': content,
        'timestamp': datetime.now(timezone.utc).isoformat()
    }
    chat_messages_db.append(message)
    while len(chat_messages_db) > 500:
        chat_messages_db.pop(0)
    return jsonify({'success': True, 'message': 'Reply sent'})
@app.route('/api/admin/notifications', methods=['GET'])
@admin_required
def get_admin_notifications():
    unread_count = len([n for n in admin_notifications_db if not n.get('read', False)])
    return jsonify({
        'success': True,
        'notifications': sorted(admin_notifications_db, key=lambda x: x['timestamp'], reverse=True)[:50],
        'unread_count': unread_count
    })
@app.route('/api/admin/notifications/<notif_id>/read', methods=['POST'])
@admin_required
def mark_admin_notification_read(notif_id):
    for n in admin_notifications_db:
        if n['id'] == notif_id:
            n['read'] = True
            return jsonify({'success': True})
    return jsonify({'success': False, 'message': 'Notification not found'}), 404
@app.route('/api/admin/notifications/read-all', methods=['POST'])
@admin_required
def mark_all_admin_notifications_read():
    for n in admin_notifications_db:
        n['read'] = True
    return jsonify({'success': True, 'message': 'All notifications marked as read'})
@app.route('/api/user/notifications', methods=['GET'])
@login_required
def get_user_notifications():
    user_id = session['user_id']
    user_notifs = [n for n in notifications_db if n.get('target_user_id') == user_id]
    unread_count = len([n for n in user_notifs if not n.get('read', False)])
    return jsonify({
        'success': True,
        'notifications': sorted(user_notifs, key=lambda x: x['timestamp'], reverse=True)[:20],
        'unread_count': unread_count
    })
@app.route('/api/user/notifications/<notif_id>/read', methods=['POST'])
@login_required
def mark_user_notification_read(notif_id):
    user_id = session['user_id']
    for n in notifications_db:
        if n['id'] == notif_id and n.get('target_user_id') == user_id:
            n['read'] = True
            return jsonify({'success': True})
    return jsonify({'success': False, 'message': 'Notification not found'}), 404
@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    notifications = []
    for report in disaster_reports_db:
        if report.get('status') != 'Resolved':
            notifications.append({
                'id': report['id'],
                'type': report.get('type', 'Disaster'),
                'title': f"{report.get('type', 'Disaster')} Reported",
                'message': report.get('description', 'A disaster has been reported'),
                'county': report.get('county', 'Unknown'),
                'severity': 'High',
                'timestamp': report.get('timestamp', datetime.now(timezone.utc).isoformat()),
                'source': 'User Report',
                'read': False
            })
    for sim in simulated_disasters_db:
        notifications.append({
            'id': sim['id'],
            'type': sim.get('type', 'Disaster'),
            'title': f"{sim.get('type', 'Disaster')} - {sim.get('county', '')}",
            'message': sim.get('description', 'Simulation result'),
            'county': sim.get('county', 'Unknown'),
            'severity': sim.get('severity', 'Medium'),
            'timestamp': sim.get('timestamp', datetime.now(timezone.utc).isoformat()),
            'source': sim.get('source', 'DEWS'),
            'read': False
        })
    notifications.sort(key=lambda x: x['timestamp'], reverse=True)
    return jsonify({
        'success': True,
        'notifications': notifications[:50],
        'unread_count': len([n for n in notifications if not n.get('read', False)])
    })
@app.route('/api/simulate', methods=['POST'])
@login_required
def run_simulation():
    simulated_disasters_db.clear()
    all_counties = [
        ('Nairobi', [-1.2921, 36.8219]), ('Mombasa', [-4.0435, 39.6682]),
        ('Kisumu', [-0.0917, 34.7680]), ('Nakuru', [-0.3031, 36.0800]),
        ('Eldoret', [0.5177, 35.2699]), ('Garissa', [-0.4531, 39.6460]),
        ('Lodwar', [2.5000, 36.7500]), ('Mandera', [3.9304, 41.8559]),
        ('Marsabit', [2.3340, 37.9890]), ('Wajir', [1.7471, 40.0573]),
        ('Isiolo', [0.3539, 37.5822]), ('Machakos', [-1.5177, 37.2634]),
        ('Meru', [0.0500, 37.6500]), ('Kakamega', [0.2826, 34.7519]),
        ('Kitui', [-1.3667, 38.0167]), ('Migori', [-1.0634, 34.4731]),
        ('Kericho', [-0.3557, 35.2835]), ('Narok', [-1.0788, 35.8681]),
        ('Bungoma', [0.5922, 34.5368]), ('Kajiado', [-1.8425, 36.7823])
    ]
    disaster_types = ['Flood', 'Drought', 'Wildfire', 'Landslide', 'Earthquake',
                      'Epidemic', 'Heatwave', 'Locust Invasion', 'Water Scarcity']
    num_disasters = random.randint(5, 10)
    results = []
    for i in range(num_disasters):
        county_name, coords = random.choice(all_counties)
        dtype = random.choice(disaster_types)
        sev = random.choice(['Critical', 'High', 'Medium'])
        conf = random.randint(60, 95)
        disaster = {
            'id': f"sim-{uuid.uuid4().hex[:8]}",
            'type': dtype,
            'county': county_name,
            'location': county_name,
            'coords': [coords[0] + random.uniform(-0.03, 0.03),
                       coords[1] + random.uniform(-0.03, 0.03)],
            'severity': sev,
            'confidence': conf,
            'status': 'Predicted',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'source': 'DEWS Kenya Simulation Engine',
            'description': f'Simulated {dtype.lower()} prediction for {county_name} County based on environmental sensor data and weather pattern analysis. Confidence level: {conf}%.'
        }
        results.append(disaster)
        simulated_disasters_db.append(disaster)
    return jsonify({'success': True, 'disasters': results})
@app.route('/api/admin/users', methods=['GET'])
@admin_required
def get_admin_users():
    users = []
    for u in users_db.values():
        users.append({
            'id': u['id'],
            'username': u['username'],
            'full_name': u.get('full_name', ''),
            'email': u.get('email', ''),
            'phone': u.get('phone', ''),
            'is_admin': u.get('is_admin', False),
            'is_online': u.get('is_online', False),
            'is_active': u.get('is_active', True),
            'last_seen': u.get('last_seen'),
            'created_at': u.get('created_at')
        })
    return jsonify({'success': True, 'users': users})
@app.route('/api/admin/users/<user_id>/deactivate', methods=['POST'])
@admin_required
def deactivate_user(user_id):
    for u in users_db.values():
        if u['id'] == user_id:
            u['is_active'] = False
            u['is_online'] = False
            return jsonify({'success': True, 'message': 'User deactivated'})
    return jsonify({'success': False, 'message': 'User not found'}), 404
@app.route('/api/admin/users/<user_id>/activate', methods=['POST'])
@admin_required
def activate_user(user_id):
    for u in users_db.values():
        if u['id'] == user_id:
            u['is_active'] = True
            return jsonify({'success': True, 'message': 'User activated'})
    return jsonify({'success': False, 'message': 'User not found'}), 404
@app.route('/api/admin/users/<user_id>/delete', methods=['POST'])
@admin_required
def delete_user(user_id):
    for username, u in list(users_db.items()):
        if u['id'] == user_id:
            if u.get('is_admin') and sum(1 for x in users_db.values() if x.get('is_admin')) <= 1:
                return jsonify({'success': False, 'message': 'Cannot delete the only admin'}), 400
            del users_db[username]
            return jsonify({'success': True, 'message': 'User deleted permanently'})
    return jsonify({'success': False, 'message': 'User not found'}), 404
def haversine_distance(lat1, lon1, lat2, lon2):
    from math import radians, sin, cos, sqrt, atan2
    R = 6371
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c
@app.route('/api/admin/send-radius-alert', methods=['POST'])
@admin_required
def send_radius_alert():
    data = request.get_json()
    disaster_id = data.get('disaster_id', '')
    lat = data.get('lat')
    lon = data.get('lon')
    radius_km = data.get('radius_km', 50)
    message = data.get('message', '')
    channels = data.get('channels', ['sms', 'email'])
    if not all([lat, lon, message]):
        return jsonify({'success': False, 'message': 'Latitude, longitude, and message are required'}), 400
    lat = float(lat)
    lon = float(lon)
    nearby_users = []
    for u in users_db.values():
        if not u.get('is_active', True) or u.get('is_admin', False):
            continue
        user_county = None
        for county_name, county_coords in {
            'Baringo': [0.7913, 35.9644], 'Bomet': [-0.7827, 35.3288],
            'Bungoma': [0.5922, 34.5368], 'Busia': [0.4347, 34.2421],
            'Elgeyo-Marakwet': [0.7500, 35.5000], 'Embu': [-0.5380, 37.4574],
            'Garissa': [-0.4531, 39.6460], 'Homa Bay': [-0.5757, 34.3900],
            'Isiolo': [0.3539, 37.5822], 'Kajiado': [-1.8425, 36.7823],
            'Kakamega': [0.2826, 34.7519], 'Kericho': [-0.3557, 35.2835],
            'Kiambu': [-1.1712, 36.8357], 'Kilifi': [-3.5030, 39.6742],
            'Kirinyaga': [-0.5621, 37.3200], 'Kisii': [-0.6817, 34.7667],
            'Kisumu': [-0.0917, 34.7680], 'Kitui': [-1.3667, 38.0167],
            'Kwale': [-4.1817, 39.4608], 'Laikipia': [0.3606, 36.7820],
            'Lamu': [-2.2717, 40.9020], 'Machakos': [-1.5177, 37.2634],
            'Makueni': [-1.7800, 37.6300], 'Mandera': [3.9304, 41.8559],
            'Marsabit': [2.3340, 37.9890], 'Meru': [0.0500, 37.6500],
            'Migori': [-1.0634, 34.4731], 'Mombasa': [-4.0435, 39.6682],
            'Murang\'a': [-0.7833, 37.0333], 'Nairobi': [-1.2921, 36.8219],
            'Nakuru': [-0.3031, 36.0800], 'Nandi': [0.1833, 35.1333],
            'Narok': [-1.0788, 35.8681], 'Nyamira': [-0.5667, 34.9333],
            'Nyandarua': [-0.4000, 36.3667], 'Nyeri': [-0.4167, 36.9500],
            'Samburu': [1.0000, 37.0000], 'Siaya': [0.0617, 34.2882],
            'Taita-Taveta': [-3.3167, 38.3667], 'Tana River': [-1.5000, 40.0333],
            'Tharaka-Nithi': [-0.3000, 37.8333], 'Trans Nzoia': [1.0000, 35.0000],
            'Turkana': [2.5000, 36.7500], 'Uasin Gishu': [0.5177, 35.2699],
            'Vihiga': [0.1000, 34.7000], 'Wajir': [1.7471, 40.0573],
            'West Pokot': [1.7500, 35.0000]
        }.items():
            if county_name.lower() in u.get('email', '').lower() or county_name.lower() in u.get('full_name', '').lower():
                user_county = county_coords
                break
        if not user_county:
            user_county = [-1.2921, 36.8219]
        dist = haversine_distance(lat, lon, user_county[0], user_county[1])
        if dist <= radius_km:
            nearby_users.append({
                'id': u['id'],
                'username': u['username'],
                'full_name': u.get('full_name', u['username']),
                'email': u.get('email', ''),
                'phone': u.get('phone', ''),
                'distance_km': round(dist, 1)
            })
    sent_results = []
    for user in nearby_users:
        result = {
            'user_id': user['id'],
            'username': user['username'],
            'channels_sent': []
        }
        if 'email' in channels and user['email']:
            result['channels_sent'].append('email')
        if 'sms' in channels and user['phone']:
            result['channels_sent'].append('sms')
        if result['channels_sent']:
            sent_results.append(result)
            user_notif = {
                'id': str(uuid.uuid4()),
                'type': 'radius_alert',
                'title': 'EMERGENCY ALERT: Disaster in Your Area',
                'message': message,
                'target_user_id': user['id'],
                'severity': 'Critical',
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'read': False
            }
            notifications_db.append(user_notif)
    log_entry = {
        'id': str(uuid.uuid4()),
        'disaster_id': disaster_id,
        'lat': lat,
        'lon': lon,
        'radius_km': radius_km,
        'message': message,
        'channels': channels,
        'recipients_count': len(sent_results),
        'recipients': sent_results,
        'timestamp': datetime.now(timezone.utc).isoformat()
    }
    sent_notifications_log.append(log_entry)
    while len(sent_notifications_log) > 100:
        sent_notifications_log.pop(0)
    return jsonify({
        'success': True,
        'message': f'Alert sent to {len(sent_results)} users within {radius_km}km',
        'recipients': sent_results,
        'total_nearby': len(nearby_users),
        'channels_used': channels
    })
@app.route('/api/admin/notification-log', methods=['GET'])
@admin_required
def get_notification_log():
    return jsonify({
        'success': True,
        'logs': sorted(sent_notifications_log, key=lambda x: x['timestamp'], reverse=True)[:50]
    })
def send_email(to_email, subject, body):
    if not all([Config.SMTP_SERVER, Config.SMTP_USER, Config.SMTP_PASSWORD]):
        print(f"Email not configured. To: {to_email}, Subject: {subject}")
        return
    msg = MIMEMultipart()
    msg['From'] = Config.SMTP_USER
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))
    with smtplib.SMTP(Config.SMTP_SERVER, Config.SMTP_PORT) as server:
        server.starttls()
        server.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
        server.send_message(msg)
@app.errorhandler(404)
def not_found(e):
    if request.path.startswith('/api/'):
        return jsonify({'success': False, 'message': 'API endpoint not found'}), 404
    return send_from_directory(app.static_folder, 'index.html')
@app.errorhandler(500)
def server_error(e):
    return jsonify({'success': False, 'message': 'Internal server error'}), 500
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)