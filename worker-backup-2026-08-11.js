export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const params = url.searchParams;

    const settings = {
      use_fake_data: params.get('use_fake_data'),
      fake_event_count: params.get('fake_event_count'),
      fake_show_avatars: params.get('fake_show_avatars'),
      fake_holiday_name: params.get('fake_holiday_name'),
      fake_date_string: params.get('fake_date_string'),
      fake_location: params.get('fake_location'),
      fake_temp: params.get('fake_temp'),
      fake_condition: params.get('fake_condition'),
      fake_high: params.get('fake_high'),
      fake_low: params.get('fake_low'),
      fake_alert: params.get('fake_alert'),
      fake_work_tim_title: params.get('fake_work_tim_title'),
      fake_work_tim_time: params.get('fake_work_tim_time'),
      fake_work_ollie_title: params.get('fake_work_ollie_title'),
      fake_work_ollie_time: params.get('fake_work_ollie_time'),
      fake_dinner_label: params.get('fake_dinner_label'),
      fake_dinner_menu: params.get('fake_dinner_menu'),
      weather_city: params.get('weather_city'),
      weather_country_code: params.get('weather_country_code'),
      weather_state: params.get('weather_state'),
      holiday_country: params.get('holiday_country'),
      dinner_calendar_id: params.get('dinner_calendar_id'),
      spotlight_label: params.get('spotlight_label'),
      garbage_sunday: params.get('garbage_sunday'),
      garbage_monday: params.get('garbage_monday'),
      garbage_tuesday: params.get('garbage_tuesday'),
      garbage_wednesday: params.get('garbage_wednesday'),
      garbage_thursday: params.get('garbage_thursday'),
      garbage_friday: params.get('garbage_friday'),
      garbage_saturday: params.get('garbage_saturday'),
      recycling_sunday: params.get('recycling_sunday'),
      recycling_monday: params.get('recycling_monday'),
      recycling_tuesday: params.get('recycling_tuesday'),
      recycling_wednesday: params.get('recycling_wednesday'),
      recycling_thursday: params.get('recycling_thursday'),
      recycling_friday: params.get('recycling_friday'),
      recycling_saturday: params.get('recycling_saturday'),
      countdown_title: params.get('countdown_title'),
      countdown_date: params.get('countdown_date'),
      utc_offset: params.get('utc_offset')
    };

    for (let i = 1; i <= 5; i++) {
      settings[`calendar_${i}_id`] = params.get(`calendar_${i}_id`);
      settings[`calendar_${i}_color`] = params.get(`calendar_${i}_color`);
      settings[`calendar_${i}_avatar_url`] = params.get(`calendar_${i}_avatar_url`);
      settings[`calendar_${i}_display_mode`] = params.get(`calendar_${i}_display_mode`);
      settings[`calendar_${i}_name`] = params.get(`calendar_${i}_name`);
      settings[`calendar_${i}_show_avatar`] = params.get(`calendar_${i}_show_avatar`);
    }

    let authHeader = request.headers.get('authorization') || '';
    authHeader = authHeader.replace('##', '');
    const oauthToken = authHeader.replace('Bearer ', '').trim();

    const useFakeData = settings.use_fake_data === 'true';

    if (useFakeData) {
      return jsonResponse(await buildFakePayload(settings, env));
    }

    try {
      const payload = await buildRealPayload(settings, oauthToken, env);
      return jsonResponse(payload);
    } catch (err) {
      return jsonResponse({ error: err.toString() });
    }
  }
};

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

const BIRTHDAY_KEYWORD = 'birthday';

function getOrdinal(day) {
  const d = parseInt(day);
  if (d % 10 === 1 && d !== 11) return 'st';
  if (d % 10 === 2 && d !== 12) return 'nd';
  if (d % 10 === 3 && d !== 13) return 'rd';
  return 'th';
}

function getLocalNow(offsetSeconds) {
  const offset = parseInt(offsetSeconds) || 0;
  return new Date(Date.now() + offset * 1000);
}

function getLocalDayBounds(offsetSeconds) {
  const offset = parseInt(offsetSeconds) || 0;
  const local = getLocalNow(offsetSeconds);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const minMs = Date.UTC(y, m, d, 0, 0, 0) - (offset * 1000);
  const maxMs = Date.UTC(y, m, d, 23, 59, 59, 999) - (offset * 1000);
  return {
    timeMin: new Date(minMs).toISOString(),
    timeMax: new Date(maxMs).toISOString()
  };
}

function parseAvatarUrls(raw) {
  if (!raw) return [];
  return raw.split(',').map(u => u.trim()).filter(Boolean);
}

function getGarbageLabel(settings, todayName) {
  const isGarbage = settings[`garbage_${todayName}`] === 'true';
  const isRecycling = settings[`recycling_${todayName}`] === 'true';
  if (isGarbage && isRecycling) return 'Garbage & Recycling Day';
  if (isGarbage) return 'Garbage Day';
  if (isRecycling) return 'Recycling Day';
  return '';
}

function getCountdown(title, dateStr, offsetSeconds) {
  if (!title || !dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00Z');
  const today = getLocalNow(offsetSeconds);
  today.setUTCHours(0, 0, 0, 0);
  const diffMs = target - today;
  const days = Math.round(diffMs / 86400000);
  if (isNaN(days)) return null;
  if (days < 0) return null;
  if (days === 0) return { days: 0, isToday: true, title };
  const dayLabel = days === 1 ? 'Day' : 'Days';
  return { days, dayLabel, isToday: false, title };
}

function formatBirthdays(titles) {
  if (titles.length === 0) return '';
  if (titles.length === 1) return titles[0];
  const names = titles.slice(0, -1).map(t => t.replace(/\s*birthday\s*$/i, '').trim().replace(/'s$/i, ''));
  const last = titles[titles.length - 1];
  if (names.length === 1) {
    return `${names[0]} & ${last}`;
  }
  return `${names.join(', ')}, & ${last}`;
}

async function getRandomQuote(env) {
  try {
    const raw = await env.QUOTES_KV.get('all_quotes');
    if (!raw) return null;
    const quotes = JSON.parse(raw);
    if (!Array.isArray(quotes) || quotes.length === 0) return null;
    return quotes[Math.floor(Math.random() * quotes.length)];
  } catch (err) {
    return null;
  }
}

async function buildFakePayload(settings, env) {
  const sampleTitles = [
    { title: 'Car Service', location: 'Pohanka Chevrolet 13915 Route 50' },
    { title: 'Team Standup', location: '' },
    { title: 'Dentist Appointment', location: '456 Oak Avenue, Suite 200, Ashburn, VA' },
    { title: 'Client Call', location: '' },
    { title: 'Soccer Practice', location: '789 Fields Park Drive, Ashburn, VA' },
    { title: 'Movie Night', location: '' },
    { title: 'Grocery Run', location: 'Whole Foods Market' },
    { title: 'Physical Therapy', location: '123 Main St' },
    { title: 'Book Club', location: '' },
    { title: 'Piano Lesson', location: '456 Elm Street' }
  ];

  const times = ['7:00 AM', '9:30 AM', '11:00 AM', '1:15 PM', '2:45 PM', '4:00 PM', '5:30 PM', '6:30 PM', '7:45 PM', '9:00 PM'];

  const calendarSlots = [1, 2, 3, 4, 5].map(i => ({
    color: settings[`calendar_${i}_color`] || 'paper',
    name: settings[`calendar_${i}_name`] || `Calendar ${i}`,
    avatarUrl: settings[`calendar_${i}_avatar_url`] || ''
  }));

  const showAvatars = settings.fake_show_avatars === 'true';

  const count = Math.max(0, parseInt(settings.fake_event_count) || 0);
  const events = [];
  for (let i = 0; i < count; i++) {
    const sample = sampleTitles[i % sampleTitles.length];
    const slot = calendarSlots[i % calendarSlots.length];
    events.push({
      time: times[i % times.length],
      title: sample.title,
      location: sample.location,
      color: slot.color,
      name: slot.name,
      show_avatar: showAvatars,
      avatar_urls: showAvatars ? parseAvatarUrls(slot.avatarUrl) : []
    });
  }

  const dateNumMatch = (settings.fake_date_string || '').match(/(\d{1,2})(?!.*\d)/);
  const fakeDateOrdinal = dateNumMatch ? getOrdinal(dateNumMatch[1]) : 'th';

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const todayName = dayNames[new Date().getDay()];
  const garbageLabel = getGarbageLabel(settings, todayName);
  const countdown = getCountdown(settings.countdown_title, settings.countdown_date, settings.utc_offset);

  return {
    date_main: settings.fake_date_string || 'Monday, July 6',
    date_ordinal: fakeDateOrdinal,
    holiday: settings.fake_holiday_name || '',
    birthdays: '',
    garbage_label: garbageLabel,
    countdown: countdown,
    weather: {
      temp: settings.fake_temp || '84',
      condition: settings.fake_condition || 'Clouds',
      icon: 'cloud',
      high: settings.fake_high || '86',
      low: settings.fake_low || '84',
      alert: settings.fake_alert || ''
    },
    location: settings.fake_location || 'Brambleton, VA',
    work_strip: [
      { title: settings.fake_work_tim_title || 'Tim Work (Office)', time: settings.fake_work_tim_time || '8:00 AM - 5:30 PM' },
      { title: settings.fake_work_ollie_title || 'Ollie Work (Home)', time: settings.fake_work_ollie_time || '9:00 AM - 5:00 PM' }
    ],
    events: events,
    dinner: settings.fake_dinner_menu ? { label: settings.fake_dinner_label || "TODAY'S DINNER", menu: settings.fake_dinner_menu } : null,
    quote: events.length === 0 ? await getRandomQuote(env) : null
  };
}

async function buildRealPayload(settings, oauthToken, env) {
  const localNow = getLocalNow(settings.utc_offset);
  const dateMain = localNow.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const dateOrdinal = getOrdinal(localNow.getUTCDate());
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const todayName = dayNames[localNow.getUTCDay()];
  const { timeMin, timeMax } = getLocalDayBounds(settings.utc_offset);

  const calendarSlots = [1, 2, 3, 4, 5].map(i => ({
    id: settings[`calendar_${i}_id`],
    color: settings[`calendar_${i}_color`] || 'paper',
    avatarUrl: settings[`calendar_${i}_avatar_url`] || '',
    mode: settings[`calendar_${i}_display_mode`] || 'event_box',
    name: settings[`calendar_${i}_name`] || `Calendar ${i}`,
    showAvatar: settings[`calendar_${i}_show_avatar`] === 'true'
  })).filter(slot => slot.id);

  const notConnected = !oauthToken || calendarSlots.length === 0;

  if (notConnected) {
    const weather = await fetchWeather(settings.weather_city, settings.weather_state, settings.weather_country_code, env);
    weather.alert = await fetchWeatherAlert(settings.weather_city, settings.weather_state, settings.weather_country_code, env);
    const garbageLabel = getGarbageLabel(settings, todayName);
    const countdown = getCountdown(settings.countdown_title, settings.countdown_date, settings.utc_offset);

    return {
      date_main: dateMain,
      date_ordinal: dateOrdinal,
      holiday: '',
      birthdays: '',
      garbage_label: garbageLabel,
      countdown: countdown,
      weather,
      location: `${settings.weather_city || ''}, ${settings.weather_state || settings.weather_country_code || ''}`,
      work_strip: [],
      events: [],
      dinner: null,
      quote: null,
      not_connected: true
    };
  }

  // Enforce: only first 2 "work_strip" slots (in order) actually go to Work Strip
  let workStripCount = 0;
  calendarSlots.forEach(slot => {
    if (slot.mode === 'work_strip') {
      workStripCount++;
      if (workStripCount > 2) slot.mode = 'event_box';
    }
  });

  const eventBoxSlots = calendarSlots.filter(s => s.mode === 'event_box');
  const workStripSlots = calendarSlots.filter(s => s.mode === 'work_strip');

  const events = [];
  const birthdayTitles = [];

  for (const slot of eventBoxSlots) {
    const calResult = await fetchCalendarEvents(slot.id, oauthToken, timeMin, timeMax, settings.utc_offset);
    calResult.events.forEach(ev => {
      if (ev.title && ev.title.toLowerCase().includes(BIRTHDAY_KEYWORD)) {
        birthdayTitles.push(ev.title);
        return;
      }
      events.push({
        time: ev.allDay ? 'All day' : ev.start,
        title: ev.title,
        location: ev.location || '',
        color: slot.color,
        name: slot.name,
        show_avatar: slot.showAvatar,
        avatar_urls: slot.showAvatar ? parseAvatarUrls(slot.avatarUrl) : [],
        sortKey: ev.sortKey
      });
    });
  }
  events.sort((a, b) => a.sortKey - b.sortKey);

  const birthdays = formatBirthdays(birthdayTitles);

  const workStrip = [];
  for (const slot of workStripSlots) {
    const calResult = await fetchCalendarEvents(slot.id, oauthToken, timeMin, timeMax, settings.utc_offset);
    calResult.events.forEach(ev => {
      if (ev.title && ev.title.toLowerCase().startsWith('work')) {
        workStrip.push({ title: `${slot.name} ${ev.title}`, time: `${ev.start} - ${ev.end}` });
      }
    });
  }

  let holiday = '';
  if (settings.holiday_country) {
    const holidayResult = await fetchCalendarEvents(settings.holiday_country, oauthToken, timeMin, timeMax, settings.utc_offset);
    if (holidayResult.events.length > 0) holiday = holidayResult.events[0].title;
  }

  let dinner = null;
  if (settings.dinner_calendar_id) {
    const dinnerResult = await fetchCalendarEvents(settings.dinner_calendar_id, oauthToken, timeMin, timeMax, settings.utc_offset);
    if (dinnerResult.events.length > 0) {
      dinner = { label: settings.spotlight_label || "TODAY'S DINNER", menu: dinnerResult.events[0].title };
    }
  }

  const weather = await fetchWeather(settings.weather_city, settings.weather_state, settings.weather_country_code, env);
  weather.alert = await fetchWeatherAlert(settings.weather_city, settings.weather_state, settings.weather_country_code, env);
  const garbageLabel = getGarbageLabel(settings, todayName);
  const countdown = getCountdown(settings.countdown_title, settings.countdown_date, settings.utc_offset);

  return {
    date_main: dateMain,
    date_ordinal: dateOrdinal,
    holiday,
    birthdays,
    garbage_label: garbageLabel,
    countdown: countdown,
    weather,
    location: `${settings.weather_city || ''}, ${settings.weather_state || settings.weather_country_code || ''}`,
    work_strip: workStrip,
    events,
    dinner,
    quote: events.length === 0 ? await getRandomQuote(env) : null,
    not_connected: false
  };
}

async function fetchCalendarEvents(calendarId, token, timeMin, timeMax, offsetSeconds) {
  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return { status: res.status, events: [] };
    const data = await res.json();
    const events = (data.items || []).map(ev => {
      const isAllDay = !!ev.start.date;
      return {
        title: ev.summary || '',
        location: ev.location || '',
        allDay: isAllDay,
        start: isAllDay ? '' : formatTime(ev.start.dateTime, offsetSeconds),
        end: isAllDay ? '' : formatTime(ev.end.dateTime, offsetSeconds),
        sortKey: isAllDay ? -1 : new Date(ev.start.dateTime).getTime()
      };
    });
    return { status: res.status, events };
  } catch (err) {
    return { status: null, events: [] };
  }
}

function formatTime(dateTimeStr, offsetSeconds) {
  const utcMs = new Date(dateTimeStr).getTime();
  const localMs = utcMs + (parseInt(offsetSeconds) || 0) * 1000;
  return new Date(localMs).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
}

function iconForOwmCode(id) {
  const s = String(id);
  if (s[0] === '2') return 'storm';
  if (s[0] === '3' || s[0] === '5') return 'rain';
  if (s[0] === '6') return 'snow';
  if (s[0] === '7') return 'fog';
  if (s === '800') return 'sun';
  if (s[0] === '8') return 'cloud';
  return 'cloud';
}

async function fetchWeather(city, state, countryCode, env) {
  const OPENWEATHER_API_KEY = env.OPENWEATHER_API_KEY;
  const query = [city, state, countryCode].filter(Boolean).join(',');
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(query)}&units=imperial&appid=${OPENWEATHER_API_KEY}`);
    const data = await res.json();
    const id = data.weather && data.weather[0] ? data.weather[0].id : 800;
    return {
      temp: Math.round(data.main.temp),
      condition: data.weather[0].main,
      icon: iconForOwmCode(id),
      high: Math.round(data.main.temp_max),
      low: Math.round(data.main.temp_min),
      alert: ''
    };
  } catch (err) {
    return { temp: '--', condition: 'Unavailable', icon: 'cloud', high: '--', low: '--', alert: '' };
  }
}

async function fetchWeatherAlert(city, state, countryCode, env) {
  if (!countryCode || countryCode.toUpperCase() !== 'US') return '';
  const OPENWEATHER_API_KEY = env.OPENWEATHER_API_KEY;
  const geoQuery = [city, state, countryCode].filter(Boolean).join(',');
  try {
    const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(geoQuery)}&limit=1&appid=${OPENWEATHER_API_KEY}`);
    const geoData = await geoRes.json();
    if (!geoData || geoData.length === 0) return '';
    const { lat, lon } = geoData[0];

    const alertRes = await fetch(`https://api.weather.gov/alerts/active?point=${lat},${lon}`, {
      headers: { 'User-Agent': 'HubbyCal-FamilyDashboard (github.com/IshyB/Hubbies)' }
    });
    const alertData = await alertRes.json();
    if (!alertData.features || alertData.features.length === 0) return '';
    return alertData.features[0].properties.event || '';
  } catch (err) {
    return '';
  }
}
