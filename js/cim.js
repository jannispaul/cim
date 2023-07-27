const CHORDS = [
    ["red", "ceg",],
    ["yellow", "cfa",],
    ["blue", "hdg",],
    ["black", "acf",], ["green", "dgh",],
    ["orange", "egc",],
    ["purple", "fac",],
    ["pink", "ghd",],
    ["brown", "gce",],
];

function get_current_timestamp() {
    return Date.now() / 1000;
}

function new_stats() {
    return {
        start_time: get_current_timestamp(),
        updated_time: get_current_timestamp(),
        identifications: 0,
        correct: 0,
        confusion_matrix: {},
    }
}

let _COLORS = null;
let _CORRECT_COLOR = null;
let _SELECTED_ELEM = null;
let _CORRECT_ELEM = null;
let _CURRENT_AUDIO = null;
let _CURRENT_INFOBOX = null;
let _PROFILE_CONTAINER = null;
let _INFOBOX_TRIGGERS = [];
let _AUDIO_PLAYED = false;
let _EMOJI_LOCK = false;
let _TRAINER_PRELOADED = false;
const _TARGET_NUMBER = 25;

const _INFOBOX_TRIGGER_IDS = [
    "trainer-infobox-trigger",
    "i-infobox-trigger",
    "profile-infobox-trigger",
];

let AUDIO_FILES = null;

const STATE_KEY = "cim_state";
const SESSION_HISTORY_KEY = "cim_session_history";

// After 30 minutes of inactivity call it a new session
const SESSION_TIMEOUT_TIME_SECONDS = 60 * 30;

let STATE = null;

function get_selected_colors() {
    // The chord selector does not include "red" as an option, so we need to
    // shift the index up by 1.
    const chord_idx = document.getElementById("chord-selector").selectedIndex + 1;
    if (_COLORS === null) {
        _COLORS = CHORDS.slice(0, chord_idx + 1).map(([x, _]) => x);
    }

    return _COLORS;
}

// TODO: Filter out non-audio files.

function get_audio_files() {
    function af_obj(filename) {
        [base, ext] = filename.split(".");
        [chord, color, _] = filename.split("_");

        return {
            filename: filename,
            color: color,
            chord: chord,
            ext: ext,
            elem: null,
        };
    }
    if (AUDIO_FILES === null) {
        AUDIO_FILES = {
            "mp3": new Map(),
            "opus": new Map(),
        };
        for (const file of UNSORTED_AUDIO_FILES) {
            let audio_file_obj = af_obj(file);
            let out_map = AUDIO_FILES[audio_file_obj["ext"]];
            if (!out_map.has(audio_file_obj.color)) {
                out_map.set(audio_file_obj.color, []);
            }

            out_map.get(audio_file_obj.color).push(audio_file_obj);
        }
    }

    return AUDIO_FILES;
}

function make_flag(flag_color) {
    const wrapper_id = flag_color + "-flag";
    let wrapper_div = document.getElementById(wrapper_id);
    if (wrapper_div === null) {
        wrapper_div = document.createElement("div");
        wrapper_div.classList.add("flag-wrapper");
        wrapper_div.id = wrapper_id;

        let inner_div = document.createElement("div");
        inner_div.classList.add("flag");
        inner_div.classList.add("fa");
        inner_div.classList.add(flag_color);

        inner_div.onclick = () => select_flag(inner_div);
        wrapper_div.appendChild(inner_div);
    }

    return wrapper_div;
}

function populate_flags() {
    const colors = get_selected_colors();
    const base_elem = document.getElementById("flag-holder");

    while (base_elem.firstChild) {
        base_elem.removeChild(base_elem.lastChild);
    }

    for (const color of colors) {
        const flag = make_flag(color);
        base_elem.appendChild(flag);
    }
}

function audio_file_elem(audio_file) {
    if (audio_file.elem === null) {
        audio_file.elem = document.createElement("audio");
        audio_file.elem.classList.add("chord");
        audio_file.elem.controls = true;
        audio_file.elem.src = "static_files/chords/" + audio_file.filename;
        audio_file.elem.onended = () => { _AUDIO_PLAYED = true; };
        audio_file.elem.onplay = register_playing(audio_file.elem);
    }

    return audio_file.elem;
}

function random_elem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function select_new_color() {
    _CORRECT_COLOR = random_elem(get_selected_colors());
    if (_SELECTED_ELEM !== null) {
        _SELECTED_ELEM.classList.remove("flag-correct");
        _SELECTED_ELEM.classList.remove("flag-incorrect");
        _SELECTED_ELEM = null;
    }

    if (_CORRECT_ELEM !== null) {
        _CORRECT_ELEM.classList.remove("flag-correct");
        _CORRECT_ELEM.classList.remove("flag-incorrect");
        _CORRECT_ELEM = null;
    }
}

function update_stats(correct_color, chosen_color) {
    const correct = correct_color === chosen_color;
    STATE.stats.identifications++;
    if (correct) {
        STATE.stats.correct++;
    }

    if (STATE.stats.confusion_matrix[correct_color] === undefined) {
        STATE.stats.confusion_matrix[correct_color] = {};
    }

    let row = STATE.stats.confusion_matrix[correct_color];
    if (row[chosen_color] === undefined) {
        row[chosen_color] = 0;
    }

    row[chosen_color] = row[chosen_color] + 1;

    STATE.stats.updated_time = get_current_timestamp();
    save_state();
}

function set_cat_emoji(level) {
    const emoji_levels = {
        0: '😿',
        1: '😾',
        2: '🐱',
        3: '😺',
        4: '😸',
        5: '🙀',
        6: '😻',
    };

    document.getElementById("reaction-emoji").innerHTML = emoji_levels[level];
}


function calculate_neutral_level(percentage) {
    const level = Math.min(Math.max(0, Math.floor((percentage - 50) / 10)), 4);
    return level;
}

function calculate_percentage() {
    if (STATE.stats.identifications == 0) {
        return 75;
    }

    return 100 * STATE.stats.correct / STATE.stats.identifications;
}


function update_stats_display() {
    let container_elem = document.getElementById("stats-container");
    let correct_elem = document.getElementById("stats-correct");
    let total_elem = document.getElementById("stats-total");
    let perc_elem = document.getElementById("stats-percent");

    const correct = STATE.stats.correct;
    const identifications = STATE.stats.identifications;

    correct_elem.innerHTML = correct;
    total_elem.innerHTML = identifications;
    let percentage = calculate_percentage();
    if (identifications > 0) {
        perc_elem.innerHTML = "(" + percentage.toFixed(1) + "%)";
    } else {
        perc_elem.innerHTML = "";
    }

    if (correct == identifications) {
        container_elem.classList.add("perfect");
    } else {
        container_elem.classList.remove("perfect");
    }

    if (identifications >= _TARGET_NUMBER) {
        container_elem.classList.add("done");
    } else {
        container_elem.classList.remove("done");
    }

    if(!_EMOJI_LOCK) {
        reset_cat_emoji();
    }
}

function reset_cat_emoji() {
    set_cat_emoji(calculate_neutral_level(calculate_percentage()));
}

function select_flag(elem) {
    if (_SELECTED_ELEM !== null) {
        return;
    }
    if (_AUDIO_PLAYED === false) {
        return;
    }
    const id = elem.parentElement.id;
    const chosen_color = id.split("-")[0];

    _EMOJI_LOCK = true;
    update_stats(_CORRECT_COLOR, chosen_color);
    update_stats_display();

    if (chosen_color === _CORRECT_COLOR) {
        elem.classList.add("flag-correct");
        set_cat_emoji(6);
    } else {
        elem.classList.add("flag-incorrect");
        _CORRECT_ELEM = document.getElementById(_CORRECT_COLOR + "-flag").firstChild;
        _CORRECT_ELEM.classList.add("flag-correct");
        set_cat_emoji(5)
    }
    _SELECTED_ELEM = elem;

    setTimeout(function() { _EMOJI_LOCK = false; reset_cat_emoji(); }, 1500);

    let next_button = document.getElementById("next-chord");
    next_button.classList.remove("deactivated");
}

function register_playing(elem) {
    return function() {
        setTimeout(() => { _AUDIO_PLAYED = true; },
                   elem.duration * 0.8);
    }
}

function play_audio() {
    if (document.getElementById("play-button").classList.contains("deactivated")) {
        return;
    }
    _CURRENT_AUDIO.play();
}

function play_chord(color) {
    const audio_files = get_audio_files();
    const audio_file = random_elem(audio_files["mp3"].get(color));
    audio_file_elem(audio_file).play();
}

function next_audio() {
    let next_button = document.getElementById("next-chord");
    if (next_button.classList.contains("deactivated")) {
        return;
    }
    populate_audio();
    _CURRENT_AUDIO.play();

    next_button.classList.add("deactivated");
}

function preload_audio(color) {
    for (const audio_file of get_audio_files()["mp3"]) {
        audio_file_elem(audio_file);
    }
}

function populate_audio() {
    const audio_files = get_audio_files();

    // Choose a color at random
    select_new_color();
    let new_audio_file = random_elem(audio_files.mp3.get(_CORRECT_COLOR));
    _CURRENT_AUDIO = audio_file_elem(new_audio_file);

    let play_button = document.getElementById("play-button");
    play_button.classList.remove("deactivated");
    _AUDIO_PLAYED = false;
}

function change_selector(to) {
    let chord_selector = document.getElementById("chord-selector");
    if (to !== undefined) {
        chord_selector.value = to;
    }
    _COLORS = null;
    populate_flags();
    populate_audio();
    STATE.current_chord = chord_selector.value;
    save_state();

    // Pre-download chord MP3s
    for (const color of _COLORS) {
        preload_audio(color);
    }
}

function reset_local_storage() {
    // Not exposed at the moment, useful for debugging.
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(SESSION_HISTORY_KEY);
}

function reset_stats() {
    save_session_history();
    STATE.stats = new_stats();
    save_state();
    update_stats_display();
}

function get_session_history() {
    let history = localStorage.getObject(SESSION_HISTORY_KEY);
    if (history === null) {
        return [];
    } else {
        return history;
    }
}

function save_session_history() {
    let session_history = get_session_history();
    session_history.push(STATE.stats);
    localStorage.setObject(SESSION_HISTORY_KEY, session_history);
}

function save_state() {
    localStorage.setObject(STATE_KEY, STATE);
}

function load_state() {
    let state = localStorage.getObject(STATE_KEY);
    if (state === null) {
        state = {
            profiles: {
                100: new_profile("Guest", "fa-user", 100),
            },
            current_chord: document.getElementById("chord-selector").value,
        }
    } else if (state["profiles"] === undefined) {
        // Need to convert old-style state into profile-based state
        updated_state = {
            profiles: {
                0: new_profile("Legacy User", "fa-user", 0),
                100: new_profile("Guest", "fa-user", 100),
            },
            current_chord: state["current_chord"],
        }

        updated_state["profiles"][0]["stats"] = state["stats"];
        state = updated_state;
    }

    if (state["current_profile"] === undefined || state["current_profile"] === null) {
        state["current_profile"] = 100;
    }

    STATE = state;
}

function new_profile(name, icon, id) {
    if (id === undefined) {
        id = 101;
        while (id in STATE["profiles"]) {
            id++;
        }
    }

    return {
        id: id,
        name: name,
        icon: icon,
        stats: new_stats(),
    }
}

function toggle_visibility(ibox_elem) {
    if (ibox_elem === _CURRENT_INFOBOX) {
        _CURRENT_INFOBOX = null;
        ibox_elem.classList.remove("visible");
    } else {
        if (_CURRENT_INFOBOX !== null) {
            toggle_visibility(_CURRENT_INFOBOX);
        }

        ibox_elem.classList.add("visible");
        _CURRENT_INFOBOX = ibox_elem;
    }
}

function clear_profile_pulldown() {
    for (var elem of document.getElementsByClassName("pulldown-profile")) {
        elem.remove();
    }
}

function _make_profile_click_handler(elem, profile) {
    document.addEventListener("click", function(event) {
        if (!(elem.contains(event.target))) {
            return;
        }

        if (event.target.classList.contains("profile-settings-icon")) {
            profile_settings(profile);
        } else {
            set_current_profile(profile);
        }

        toggle_profile_visibility();
    });
}

function add_profile_pulldown_element(profile) {
    if (_PROFILE_CONTAINER === null) {
        _PROFILE_CONTAINER = document.getElementById("profile-container");
    }


    let pulldownContainer = _PROFILE_CONTAINER;

    let divElem = document.createElement("div");
    divElem.classList.add("pulldown-item");
    divElem.classList.add("pulldown-profile");
    divElem.dataset.profileId = profile["id"];
    _make_profile_click_handler(divElem, profile);
    pulldownContainer.insertBefore(divElem, pulldownContainer.lastElementChild);

    let iconElem = document.createElement("i");
    iconElem.classList.add("profile-icon");
    iconElem.classList.add("fa");
    iconElem.classList.add("fa-solid");
    iconElem.classList.add(profile["icon"]);
    divElem.appendChild(iconElem);

    let settingsIconElem = document.createElement("i");
    settingsIconElem.classList.add("profile-settings-icon");
    settingsIconElem.classList.add("fa");
    settingsIconElem.classList.add("fa-solid");
    settingsIconElem.classList.add("fa-gear");
    divElem.appendChild(settingsIconElem);

    let spanElem = document.createElement("span");
    spanElem.classList.add("profile-name");
    spanElem.textContent = profile["name"];
    divElem.appendChild(spanElem);
}

function populate_profile_pulldown() {
    if (STATE === null) {
        return;
    }

    // Remove all existing pulldown items
    clear_profile_pulldown();

    for (const profile of Object.values(STATE["profiles"])) {
        add_profile_pulldown_element(profile);
    }
}

function select_new_profile(elem) {
    const id = elem.dataset.profileId;
    STATE["current_profile"] = id;
    set_current_profile(STATE["profiles"][id]);
}

function add_profile() {
    //TODO: Implement
    console.log("Creating new profile");
}

function profile_settings(profile) {
    // TODO: Implement
    console.log("Modifying settings for " + profile["name"]);
}

function set_current_profile(profile) {
    let profileIconElem = document.getElementById("profile-icon");
    if (profileIconElem.dataset.userIcon !== undefined) {
        profileIconElem.classList.remove(profileIconElem.dataset.userIcon);
    }

    const user_icon = profile["icon"];
    profileIconElem.classList.add(user_icon);
    profileIconElem.dataset.userIcon = user_icon;

    let profileNameSpanElem = document.getElementById("profile-text");
    profileNameSpanElem.textContent = profile["name"];

    STATE["current_profile"] = profile["id"];
    save_state();
}

function populate_infobox_triggers() {
    for (const trigger_id of _INFOBOX_TRIGGER_IDS) {
        _INFOBOX_TRIGGERS.push(document.getElementById(trigger_id));
    }
}

function toggle_profile_visibility() {
    toggle_visibility(document.getElementById("profile-container"));
}

function toggle_trainer_visibility() {
    toggle_visibility(document.getElementById("trainer-infobox"));
    if (!_TRAINER_PRELOADED) {
        for (const [color, _] of CHORDS) {
            preload_audio(color);
        }
    }
}

function toggle_infobox_visibility() {
    toggle_visibility(document.getElementById("i-infobox"));
}

function toggle_theme_mode() {
    document.body.classList.toggle("colorscheme-dark");
    document.body.classList.toggle("colorscheme-light");
}

document.addEventListener("DOMContentLoaded", function() {
    load_state();
    if (STATE.stats !== undefined && STATE.stats.updated_time !== undefined) {
        if (get_current_timestamp() - STATE.stats.updated_time > SESSION_TIMEOUT_TIME_SECONDS) {
            reset_stats();
        }
    }

    set_current_profile(STATE["profiles"][STATE["current_profile"]]);
    populate_infobox_triggers();
    populate_profile_pulldown();
    change_selector(STATE.current_chord);
    update_stats_display();
});

document.addEventListener("click", function(event) {
    if (_CURRENT_INFOBOX === null || _CURRENT_INFOBOX.contains(event.target)) {
        return;
    }

    for (const infobox_trigger of _INFOBOX_TRIGGERS) {
        if (infobox_trigger.contains(event.target) ) {
            return;
        }
    }

    toggle_visibility(_CURRENT_INFOBOX);
});

// Support storing and retrieving objects from localStorage
Storage.prototype.setObject = function(key, value) {
    this.setItem(key, JSON.stringify(value));
}

Storage.prototype.getObject = function(key) {
    var value = this.getItem(key);
    return value && JSON.parse(value);
}
