// ============================================================
// ECHO NARRATOR CORE (shared by every Echo game)
// Copyright 2025 Asa Hartz Games - FREE for the community
//
// BLIND FIRST. ALWAYS.
//
// THIS FILE IS THE SAME IN EVERY ECHO GAME. Each game keeps its
// own copy, so no game depends on another being online. If you
// change it in one game, copy it to the others.
//
// WHAT IT DOES
// - Loads a small language model that runs on the player's own
//   device, and keeps it there for next time.
// - Handles the voice commands: narrator on, narrator off,
//   narrator status.
// - Writes lines for a game on request, one at a time, and throws
//   away anything that fails that game's checks.
// It knows nothing about any one game. Each game has its own
// small narrator file that says what to write and where to say it.
//
// ONE DOWNLOAD FOR ALL GAMES
// Every Echo game lives at the same web address, and a browser
// shares storage across one address. So the model downloads once,
// and "narrator on" in one game carries over to the others.
//
// WHAT LEAVES THE DEVICE
// Nothing the player says or does. The only network use is
// fetching two things: the wllama engine (from jsDelivr) and the
// model file (from Hugging Face, once, then kept on the device).
// ============================================================

(function () {

    if (window.EchoNarratorCore) return;   // already loaded

    // ------------------------------------------------------------
    // NARRATOR CORE SECTION 1: SETTINGS
    // Swap modelRepo and modelFile to use a different model, such
    // as Flowers once there is a GGUF file of it on Hugging Face.
    // ------------------------------------------------------------

    var WLLAMA_BASE = 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.7/esm/';

    var CONFIG = {
        modelRepo: 'unsloth/SmolLM2-360M-Instruct-GGUF',
        modelFile: 'SmolLM2-360M-Instruct-Q4_K_M.gguf',
        modelSizeSpoken: '270 megabytes',
        engineUrl: WLLAMA_BASE + 'index.js',
        wasmSingle: WLLAMA_BASE + 'single-thread/wllama.wasm',
        wasmMulti: WLLAMA_BASE + 'multi-thread/wllama.wasm',
        contextSize: 2048,
        maxTokens: 48,
        triesPerRoom: 3,
        storageKey: 'echoDungeon_narrator'
    };

    // ------------------------------------------------------------
    // NARRATOR CORE SECTION 2: NARRATOR STATE
    // state is one of: off, loading, ready, failed
    // ------------------------------------------------------------

    var narrator = {
        state: 'off',
        enabled: false,
        progress: 0,
        engine: null,
        queue: [],
        busy: false,
        pendingNotice: '',
        awaitingConfirm: false,
        bootChecked: false,
        written: 0,
        discarded: 0,
        lastRoom: null,
        lastError: ''
    };
    window.EchoNarrator = narrator;

    // What each game plugs in. See init() at the bottom of this file.
    var hooks = {
        say: null,                  // how this game speaks one line
        onReady: null,              // called once the model is awake
        linesNoun: 'lines'          // what "narrator status" calls the lines it wrote
    };

    function sayLine(text) {
        if (hooks.say) hooks.say(text);
    }

    function readPreference() {
        try { return localStorage.getItem(CONFIG.storageKey); } catch (e) { return null; }
    }

    function writePreference(value) {
        try { localStorage.setItem(CONFIG.storageKey, value); } catch (e) { /* ignore */ }
    }

    // Returns a spoken reason the narrator cannot run here, or '' if it can.
    function cannotRunReason() {
        if (!/^https?:$/.test(location.protocol)) {
            return 'The narrator needs the game to be opened from a web address, not from a file on the device. Everything else in the game works as always.';
        }
        if (typeof WebAssembly !== 'object' || !navigator.storage || !navigator.storage.getDirectory) {
            return 'Sorry, this browser cannot run the narrator. Everything else in the game works as always.';
        }
        return '';
    }

    // ------------------------------------------------------------
    // NARRATOR CORE SECTION 3: LOADING THE MODEL
    // Runs in the background. The player keeps playing.
    // ------------------------------------------------------------

    function releaseEngine() {
        var engine = narrator.engine;
        narrator.engine = null;
        narrator.busy = false;
        narrator.queue = [];
        if (engine && typeof engine.exit === 'function') {
            try {
                var closing = engine.exit();
                if (closing && typeof closing.catch === 'function') closing.catch(function () {});
            } catch (e) { /* ignore */ }
        }
    }

    function startLoading() {
        narrator.state = 'loading';
        narrator.enabled = true;
        narrator.progress = 0;
        narrator.lastError = '';
        narrator.lastRoom = null;

        var loadLibrary;
        try {
            // Written this way so very old browsers do not choke on the word "import".
            loadLibrary = (new Function('url', 'return import(url);'))(CONFIG.engineUrl);
        } catch (e) {
            loadLibrary = Promise.reject(e);
        }

        loadLibrary.then(function (library) {
            var engine = new library.Wllama({
                'single-thread/wllama.wasm': CONFIG.wasmSingle,
                'multi-thread/wllama.wasm': CONFIG.wasmMulti
            }, {
                suppressNativeLog: true,
                allowOffline: true
            });
            narrator.engine = engine;
            return engine.loadModelFromHF(CONFIG.modelRepo, CONFIG.modelFile, {
                n_ctx: CONFIG.contextSize,
                progressCallback: function (p) {
                    if (p && p.total) {
                        narrator.progress = Math.floor((p.loaded / p.total) * 100);
                    }
                }
            });
        }).then(function () {
            if (narrator.state !== 'loading') {
                // The player said narrator off while it was loading.
                releaseEngine();
                return;
            }
            narrator.state = 'ready';
            writePreference('on');
            narrator.pendingNotice = 'The narrator is fully awake now. Try to contain your excitement.';
            if (hooks.onReady) hooks.onReady();
        }).catch(function (err) {
            narrator.lastError = String((err && err.message) || err);
            if (window.console) console.warn('Echo narrator could not load:', narrator.lastError);
            if (narrator.state !== 'loading') {
                releaseEngine();
                return;
            }
            narrator.state = 'failed';
            releaseEngine();
            narrator.pendingNotice = 'The narrator could not get ready this time, so the game will carry on with its usual descriptions. Say narrator on to try again.';
        });
    }

    // On the first command of a session, wake the narrator by itself
    // if the player had it on last time. No download is needed then.
    function bootCheck() {
        if (narrator.bootChecked) return;
        narrator.bootChecked = true;
        if (readPreference() === 'on' && narrator.state === 'off' && !cannotRunReason()) {
            startLoading();
        }
    }

    // ------------------------------------------------------------
    // NARRATOR CORE SECTION 4: VOICE COMMANDS
    // narrator on, narrator yes, narrator off, narrator status
    // ------------------------------------------------------------

    function turnOn(confirmed) {
        if (narrator.state === 'ready') {
            sayLine('The narrator is already awake and describing rooms for you.');
            return;
        }
        if (narrator.state === 'loading') {
            sayLine('The narrator is still getting ready. ' + progressSpoken());
            return;
        }
        var problem = cannotRunReason();
        if (problem) {
            sayLine(problem);
            return;
        }
        var downloadedBefore = readPreference() !== null;
        if (!downloadedBefore && !confirmed && !narrator.awaitingConfirm) {
            narrator.awaitingConfirm = true;
            sayLine('The narrator is an optional storyteller that runs entirely on your own device. ' +
                  'It needs a one time download of about ' + CONFIG.modelSizeSpoken + ', so wifi is best. ' +
                  'Say narrator yes to begin, or narrator off to cancel.');
            return;
        }
        narrator.awaitingConfirm = false;
        sayLine('Wonderful! The narrator is waking up. Keep playing. You will hear a few remarks already, and more once the narrator is fully awake.');
        startLoading();
    }

    function turnOff() {
        var wasWaiting = narrator.awaitingConfirm;
        narrator.awaitingConfirm = false;
        narrator.pendingNotice = '';
        if (wasWaiting) {
            sayLine('No problem. The narrator will stay off.');
            return;
        }
        if (!narrator.enabled && narrator.state === 'off') {
            sayLine('The narrator is already off.');
            return;
        }
        narrator.state = 'off';
        narrator.enabled = false;
        if (readPreference() !== null) writePreference('off');
        releaseEngine();
        sayLine('The narrator is resting. The game will use its usual descriptions. Say narrator on whenever you would like the narrator back.');
    }

    function progressSpoken() {
        if (narrator.progress > 0 && narrator.progress < 100) {
            return 'The download is ' + narrator.progress + ' percent done.';
        }
        return 'It should not be long now.';
    }

    function reportStatus() {
        if (narrator.awaitingConfirm) {
            sayLine('The narrator is waiting for your answer. Say narrator yes to begin the download, or narrator off to cancel.');
        } else if (narrator.state === 'ready') {
            sayLine('The narrator is awake. So far the narrator has written ' + narrator.written +
                  ' ' + hooks.linesNoun + ' and thrown away ' + narrator.discarded + '.');
        } else if (narrator.state === 'loading') {
            sayLine('The narrator is getting ready. ' + progressSpoken());
        } else if (narrator.state === 'failed') {
            sayLine('The narrator could not get ready last time. Say narrator on to try again.');
        } else {
            sayLine('The narrator is off. Say narrator on to wake the narrator.');
        }
    }

    function handleNarratorCommand(cmd) {
        if (/\b(off|of|stop|quiet|disable|cancel|no)\b/.test(cmd)) {
            turnOff();
        } else if (/\b(status|progress|ready|awake)\b/.test(cmd)) {
            reportStatus();
        } else if (/\b(yes|confirm|begin|okay|ok)\b/.test(cmd)) {
            turnOn(narrator.awaitingConfirm);
        } else {
            turnOn(false);
        }
    }

    // ------------------------------------------------------------
    // NARRATOR CORE SECTION 5: WRITING LINES FOR A GAME
    // A game hands over a job: what to ask the model, how to check
    // the answer, and what to do with it. Jobs are done one at a
    // time so the phone is never overloaded.
    // ------------------------------------------------------------

    // Builds the conversation the model sees: the instructions, a few
    // worked examples, then the new request.
    function buildMessages(systemPrompt, examples, request) {
        var messages = [{ role: 'system', content: systemPrompt }];
        for (var i = 0; i < examples.length; i++) {
            messages.push({ role: 'user', content: examples[i][0] });
            messages.push({ role: 'assistant', content: examples[i][1] });
        }
        messages.push({ role: 'user', content: request });
        return messages;
    }

    // Keeps the first sentence of what the model wrote, or returns ''
    // if it should be thrown away. "blocked" is a list of words this
    // game does not allow, written as a pattern.
    function cleanSentence(raw, blocked) {
        if (typeof raw !== 'string') return '';
        var text = raw.replace(/[\r\n]+/g, ' ').replace(/["\u201C\u201D*#_`]/g, '').replace(/\u2019/g, "'").trim();
        var firstSentence = text.match(/^(.+?[.!?])(\s|$)/);
        if (!firstSentence) return '';              // cut off before the sentence ended
        text = firstSentence[1].trim();
        if (text.length < 25 || text.length > 200) return '';
        if (/\d/.test(text)) return '';              // no invented numbers
        if (text.indexOf(':') !== -1) return '';     // it repeated the prompt instead of answering
        if (/[^\x20-\x7E]/.test(text)) return '';    // plain characters only, so speech reads it cleanly
        if (blocked && blocked.test(text)) return '';
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    // job.messages   what to ask (see buildMessages)
    // job.clean      checks the answer and returns the line, or ''
    // job.onText     called with a good line
    // job.onNothing  called when the answer was thrown away
    function enqueue(job) {
        narrator.queue.push(job);
        pump();
    }

    function clearQueue() {
        narrator.queue = [];
    }

    function pump() {
        if (narrator.busy || narrator.state !== 'ready' || !narrator.engine) return;
        var job = narrator.queue.shift();
        if (!job) return;
        narrator.busy = true;
        var engineAtStart = narrator.engine;
        var attempt;
        try {
            attempt = narrator.engine.createChatCompletion(job.messages, {
                nPredict: CONFIG.maxTokens,
                useCache: true,
                sampling: { temp: 0.8, top_k: 40, top_p: 0.9, penalty_repeat: 1.1 }
            }).then(job.clean);
        } catch (e) {
            attempt = Promise.reject(e);
        }
        attempt.then(function (text) {
            if (text) {
                narrator.written++;
                if (job.onText) job.onText(text);
            } else {
                narrator.discarded++;
                if (job.onNothing) job.onNothing();
            }
        }).catch(function (err) {
            narrator.lastError = String((err && err.message) || err);
            try { if (job.onNothing) job.onNothing(); } catch (e) { /* ignore */ }
            // If the model's working memory filled up, empty it so the next job starts clean.
            if (engineAtStart && typeof engineAtStart.kvClear === 'function') {
                return engineAtStart.kvClear().catch(function () {});
            }
        }).then(function () {
            if (narrator.engine !== engineAtStart) return;   // narrator was turned off meanwhile
            narrator.busy = false;
            setTimeout(pump, 50);
        });
    }

    // Picks lines in a shuffled order, so nothing repeats until the whole list has been heard.
    function pickFrom(list) {
        if (!list || !list.length) return '';
        if (!list.bag || !list.bag.length) {
            list.bag = list.slice();
            for (var i = list.bag.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var swap = list.bag[i]; list.bag[i] = list.bag[j]; list.bag[j] = swap;
            }
        }
        return list.bag.pop();
    }

    // ------------------------------------------------------------
    // NARRATOR CORE SECTION 6: WHAT A GAME CAN USE
    // ------------------------------------------------------------

    // True if what was heard is meant for the narrator.
    function isCommand(heardText) {
        return /\b(narrator|narrators|narration|narrate|storyteller|story teller)\b/.test(String(heardText || '').toLowerCase());
    }

    // Returns the "narrator is awake" or "could not load" notice once, then forgets it.
    function takeNotice() {
        var notice = narrator.pendingNotice;
        narrator.pendingNotice = '';
        return notice;
    }

    // A game calls this once, to say how it speaks and what to do when the model wakes.
    function init(options) {
        options = options || {};
        hooks.say = options.say || null;
        hooks.onReady = options.onReady || null;
        hooks.linesNoun = options.linesNoun || 'lines';
    }

    window.EchoNarratorCore = {
        narrator: narrator,
        CONFIG: CONFIG,
        init: init,
        bootCheck: bootCheck,
        isCommand: isCommand,
        handleCommand: function (heardText) { handleNarratorCommand(String(heardText || '').toLowerCase()); },
        takeNotice: takeNotice,
        buildMessages: buildMessages,
        cleanSentence: cleanSentence,
        enqueue: enqueue,
        clearQueue: clearQueue,
        pickFrom: pickFrom
    };

    // ------------------------------------------------------------
    // END OF ECHO NARRATOR CORE
    // Making accessibility the norm in blind gaming.
    // ------------------------------------------------------------

})();
