/* global p5, userStartAudio */
import React, { useRef, useEffect, useState } from "react";

export default function SynthUI() {
  const rootFreq = 261.63; // C4
  const scale = [
    1,        // Unison
    9 / 8,    // Major Second
    5 / 4,    // Major Third
    4 / 3,    // Perfect Fourth
    3 / 2,    // Perfect Fifth
    5 / 3,    // Major Sixth
    15 / 8    // Major Seventh
  ];
  const keyMap = {
    lower: "zxcvbnm", // C, D, E, F, G, A, B
    middle: "asdfghj",// C, D, E, F, G, A, B
    upper: "qwertyuı" // C, D, E, F, G, A, B (Note: 'ı' might be an issue on some keyboards/OS, 'i' is safer if 'u' is 7th)
    // Consider 'i' or 'o' for the 7th key in upper row if 'ı' is problematic. For now, using as is.
  };

  const getKeyInfo = (key) => {
    const lowerKey = key.toLowerCase(); // Handle caps lock
    if (keyMap.lower.includes(lowerKey)) return { index: keyMap.lower.indexOf(lowerKey), octaveShift: -1 };
    if (keyMap.middle.includes(lowerKey)) return { index: keyMap.middle.indexOf(lowerKey), octaveShift: 0 };
    if (keyMap.upper.includes(lowerKey)) return { index: keyMap.upper.indexOf(lowerKey), octaveShift: 1 };
    return null;
  };

  const canvasRef = useRef(null);
  const oscRef = useRef(null);
  const envRef = useRef(null);
  const reverbRef = useRef(null);
  const delayRef = useRef(null);
  const distortionRef = useRef(null);
  const fftRef = useRef(null);
  const pressedKeysRef = useRef(new Set());
  const currentAmpRef = useRef(0);
  const prevFreq = useRef(0);
  const midiHeldNotesRef = useRef(new Set());

  // ADSR
  const [attack, setAttack] = useState(0.05); // Slightly faster default attack
  const [decay, setDecay] = useState(0.1);
  const [sustain, setSustain] = useState(0.2); // Default sustain level (0 to 1)
  const [release, setRelease] = useState(0.15); // Slightly longer default release

  // Oscillator
  const [oscillatorType, setOscillatorType] = useState("sine");

  // Octave
  const [octave, setOctave] = useState(4); // Default octave

  // Reverb
  const [reverbTime, setReverbTime] = useState(0.0);
  const [reverbDryWet, setReverbDryWet] = useState(0.0);
  const [reverbDecay, setReverbDecay] = useState(0.0); // This is decay rate for p5.Reverb

  // Delay
  const [delayTime, setDelayTime] = useState(0);
  const [delayFeedback, setDelayFeedback] = useState(0);
  const [delayFilter, setDelayFilter] = useState(2300);

  // Distortion
  const [distortionAmount, setDistortionAmount] = useState(0.0); // This is gain for p5.Distortion
  const [distortionDryWet, setDistortionDryWet] = useState(0.0);

  // Audio Start & Gate Mode
  const [audioStarted, setAudioStarted] = useState(false);
  const [gateMode, setGateMode] = useState(true);

  // p5.js sketch effect
  useEffect(() => {
    if (!audioStarted) return;

    const sketch = (p) => {
      p.setup = () => {
        p.createCanvas(600, 150).parent(canvasRef.current);
        p.background(30); // Initial background draw

        envRef.current = new p5.Envelope();
        envRef.current.setADSR(attack, decay, sustain, release);
        envRef.current.setRange(0.5, 0); // Max amplitude, min amplitude

        // Initialize oscillator with the current type from state
        oscRef.current = new p5.Oscillator(oscillatorType);
        oscRef.current.amp(envRef.current); // Use envelope for amplitude
        oscRef.current.start();
        oscRef.current.amp(0); // Start silent

        distortionRef.current = new p5.Distortion();
        distortionRef.current.process(oscRef.current, distortionAmount, 'none'); // Set amount, oversample
        distortionRef.current.drywet(distortionDryWet);
        // Note: p5.Distortion doesn't have its own .amp(), it modifies the source.

        delayRef.current = new p5.Delay();
        // Process the (potentially distorted) oscillator
        delayRef.current.process(distortionRef.current, delayTime, delayFeedback, delayFilter);
        // delayRef.current.amp(1); // Delay doesn't have amp, it passes through

        reverbRef.current = new p5.Reverb();
        reverbRef.current.process(delayRef.current, reverbTime, reverbDecay);
        reverbRef.current.process(oscRef.current, reverbTime, reverbDecay);
        reverbRef.current.process(distortionRef.current, reverbTime, reverbDecay);
        reverbRef.current.drywet(reverbDryWet);
        // reverbRef.current.amp(1); // Reverb amp is more like a master output level for its processed signal.

        fftRef.current = new p5.FFT();
        fftRef.current.setInput(reverbRef.current); // Analyze the final output of the chain
        fftRef.current.setInput(distortionRef.current); // Analyze the final output of the chain
        fftRef.current.setInput(delayRef.current); // Analyze the final output of the chain
        fftRef.current.setInput(oscRef.current); // Analyze the final output of the chain

      };

      p.draw = () => {
        p.background(30);
        const halfWidth = p.width/2;

        if (fftRef.current) {
            const waveform = fftRef.current.waveform();
            p.stroke(255);
            p.noFill();
            p.beginShape();
            for (let i = 0; i < waveform.length; i++) {
            const x = p.map(i, 0, waveform.length, 0, halfWidth - 20); // Added some padding
            const y = p.map(waveform[i], -1, 1, p.height, 0); // Flipped y-axis for typical display
            p.vertex(x, y);
            }
            p.endShape();

            const spectrum = fftRef.current.analyze();
            p.noStroke();
            p.fill("#f5ef71");
            const spectrumWidth = halfWidth - 20; // Width for spectrum
            for (let i = 0; i < spectrum.length; i++) {
            const x = p.map(i, 0, spectrum.length, halfWidth + 20, p.width);
            const h = p.map(spectrum[i], 0, 255, 0, -p.height); // Map to negative height
            p.rect(x, p.height, spectrumWidth / spectrum.length, h);
            }
        }
      };
    };

    const myp5 = new p5(sketch);
    return () => {
      // Cleanup p5 instance and audio components if necessary
      if (oscRef.current) {
        oscRef.current.stop();
        oscRef.current.disconnect();
      }
      if (reverbRef.current) reverbRef.current.disconnect();
      if (delayRef.current) delayRef.current.disconnect();
      if (distortionRef.current) distortionRef.current.disconnect();
      // Other cleanups as needed
      myp5.remove();
    };
  }, [audioStarted]); // Only re-run sketch if audioStarted changes

  // Effect for updating oscillator type
  useEffect(() => {
    if (audioStarted && oscRef.current && oscRef.current.setType) {
      oscRef.current.setType(oscillatorType);
    }
  }, [oscillatorType, audioStarted]);

  // Effect for ADSR updates
  useEffect(() => {
    if (envRef.current) {
      envRef.current.setADSR(attack, decay, sustain, release);
      // For p5.Envelope, setRange defines the attack level and release level (min level).
      // If sustain is a level (0-1) and not a time, ADSR should be:
      // attackTime, decayTime, sustainLevel (0-1), releaseTime
      envRef.current.setRange(0.5, 0); // Attack Level 0.5, Min Level 0
    }
  }, [attack, decay, sustain, release, audioStarted]);

  // Effect for Delay updates
  useEffect(() => {
    if (delayRef.current && audioStarted) {
      delayRef.current.delayTime(delayTime);
      delayRef.current.feedback(delayFeedback);
      delayRef.current.filter(delayFilter);
    }
  }, [delayTime, delayFeedback, delayFilter, audioStarted]);

  // Effect for Reverb updates
  useEffect(() => {
    if (reverbRef.current && audioStarted) {
      // p5.Reverb.set(seconds, decayRate, reverse?)
      reverbRef.current.set(reverbTime, reverbDecay);
      reverbRef.current.drywet(reverbDryWet);
    }
  }, [reverbTime, reverbDecay, reverbDryWet, audioStarted]);

  // Effect for Distortion updates
  useEffect(() => {
    if (distortionRef.current && audioStarted) {
      // p5.Distortion.set(amount, oversample)
      distortionRef.current.set(distortionAmount, '2x'); // Default 'none', can be '2x' or '4x'
      distortionRef.current.drywet(distortionDryWet);
    }
  }, [distortionAmount, distortionDryWet, audioStarted]);


  // Keyboard event listeners
  useEffect(() => {
    if (!audioStarted) return;

    const handleKeyDown = (e) => {
      if (!oscRef.current || !envRef.current) return;
      // Prevent re-triggering if key is already held (e.g., OS key repeat)
      if (pressedKeysRef.current.has(e.key.toLowerCase())) return;


      const keyInfo = getKeyInfo(e.key);
      if (!keyInfo) return;

      pressedKeysRef.current.add(e.key.toLowerCase());
      const freq = rootFreq * scale[keyInfo.index] * Math.pow(2, octave + keyInfo.octaveShift - 4);

      if (gateMode) {
        // currentAmpRef isn't directly setting p5 amp here, more like a conceptual state.
        // p5.Oscillator.amp() is controlled by the envelope or direct calls.
        if (pressedKeysRef.current.size === 1) { // First key pressed
          oscRef.current.freq(freq, 0.005); // Quick ramp for new note
          // For gate mode, we want direct control, not full ADSR cycle unless it's the first note.
          // Ramp to sustain level using attack time.
          oscRef.current.amp(sustain, attack); // Ramp to sustain level
        } else { // Legato: already a note playing
          oscRef.current.freq(freq, 0.02); // Smoother glide for legato
          // Amplitude should already be at sustain level, no need to re-trigger amp.
        }
        prevFreq.current = freq;
      } else { // Envelope mode
        oscRef.current.freq(freq);
        envRef.current.triggerAttack(oscRef.current); // Or simply envRef.current.play();
      }
    };

    const handleKeyUp = (e) => {
      if (!oscRef.current || !envRef.current || !pressedKeysRef.current.has(e.key.toLowerCase())) return;

      pressedKeysRef.current.delete(e.key.toLowerCase());

      if (gateMode) {
        if (pressedKeysRef.current.size === 0) { // Last key released
          oscRef.current.amp(0, release); // Fade out using release time
        } else {
          // Another key is still held, find it and play its note (optional re-trigger or just continue)
          // This implements a form of "last note priority" for legato
          const lastPressedPhysicalKey = Array.from(pressedKeysRef.current).pop();
          const keyInfo = getKeyInfo(lastPressedPhysicalKey);
          if (keyInfo) {
            const freq = rootFreq * scale[keyInfo.index] * Math.pow(2, octave + keyInfo.octaveShift - 4);
            oscRef.current.freq(freq, 0.02); // Glide to the held note
            prevFreq.current = freq;
          }
        }
      } else { // Envelope mode
        // Only trigger release if no other keys are held (for mono synth behavior)
        if (pressedKeysRef.current.size === 0) {
          envRef.current.triggerRelease(oscRef.current); // Or simply envRef.current.release();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [audioStarted, octave, gateMode, attack, release, sustain, scale, rootFreq, envRef, oscRef]); // Added envRef, oscRef for safety


  // MIDI event listener
  useEffect(() => {
    if (!audioStarted || !navigator.requestMIDIAccess) {
      if (navigator.requestMIDIAccess) { /* console.log("MIDI ready when audio starts."); */ }
      else console.warn("Web MIDI API not supported in this browser.");
      return;
    }

    let midiAccessInstance = null;

    const onMIDIMessage = (event) => {
      if (!oscRef.current || !envRef.current) return;

      const [status, note, velocity] = event.data;
      const command = status & 0xf0; //  0x90 for note on, 0x80 for note off
      const freq = 440 * Math.pow(2, (note - 69) / 12); // MIDI note to frequency

      if (command === 0x90 && velocity > 0) { // Note On
        midiHeldNotesRef.current.add(note);

        if (gateMode) {
          if (midiHeldNotesRef.current.size === 1) { // First MIDI note
            oscRef.current.freq(freq, 0.005);
            oscRef.current.amp(sustain, attack); // Ramp to sustain level
          } else { // Legato for MIDI
            oscRef.current.freq(freq, 0.02); // Glide
          }
        } else { // Envelope mode for MIDI
          oscRef.current.freq(freq);
          envRef.current.triggerAttack(oscRef.current);
        }
        prevFreq.current = freq;

      } else if (command === 0x80 || (command === 0x90 && velocity === 0)) { // Note Off
        midiHeldNotesRef.current.delete(note);

        if (gateMode) {
          if (midiHeldNotesRef.current.size === 0) { // Last MIDI note released
            oscRef.current.amp(0, release);
          } else {
            // Optional: Last note priority for MIDI legato
            const lastMidiNote = Array.from(midiHeldNotesRef.current).pop();
            if (lastMidiNote) {
                const newFreq = 440 * Math.pow(2, (lastMidiNote - 69) / 12);
                oscRef.current.freq(newFreq, 0.02);
                prevFreq.current = newFreq;
            }
          }
        } else { // Envelope mode for MIDI
          if (midiHeldNotesRef.current.size === 0) {
            envRef.current.triggerRelease(oscRef.current);
          }
        }
      }
    };

    navigator.requestMIDIAccess()
      .then((midi) => {
        midiAccessInstance = midi;
        for (let input of midiAccessInstance.inputs.values()) {
          input.onmidimessage = onMIDIMessage;
        }
        midiAccessInstance.onstatechange = (event) => {
            // Optional: handle MIDI device connection/disconnection
            console.log("MIDI state change:", event.port.name, event.port.manufacturer, event.port.state);
             // Re-attach listeners if necessary, though p5 might handle this well
            for (let input of midiAccessInstance.inputs.values()) {
                input.onmidimessage = onMIDIMessage;
            }
        };
      })
      .catch((err) => {
        console.error("MIDI access error:", err);
      });

    return () => {
      if (midiAccessInstance) {
        for (let input of midiAccessInstance.inputs.values()) {
          input.onmidimessage = null; // Remove listener
        }
      }
    };
  }, [audioStarted, gateMode, attack, release, sustain, envRef, oscRef]); // Added envRef, oscRef

  const startAudioContext = async () => {
    try {
      await p5.prototype.userStartAudio(); // This is the standard p5 way
      setAudioStarted(true);
      console.log("Audio context started successfully.");
    } catch (e) {
      console.error("Error starting audio context with p5.prototype.userStartAudio:", e);
      // Fallback or alternative if the above doesn't work in some setup
      // (though `p5.prototype.userStartAudio()` should be the way)
      try {
        const p5Instance = new p5(() => {}); // Create a dummy instance
        await p5Instance.userStartAudio();
        setAudioStarted(true);
        p5Instance.remove(); // Clean up dummy instance
        console.log("Audio context started with dummy instance.");
      } catch (e2) {
          console.error("Error starting audio context with dummy instance:", e2);
          alert("Could not start audio. Please check browser permissions.");
      }
    }
  };


  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5 text-white bg-gray-900 min-h-screen font-sans">
      <h1 className="text-3xl font-bold text-yellow-400 text-center">MonoSynth VMI003</h1>

      {!audioStarted && (
        <div className="text-center">
            <button
            className="bg-green-500 hover:bg-green-600 text-black px-6 py-3 rounded-lg text-lg font-semibold shadow-md transition-colors"
            onClick={startAudioContext}
            >
            Start Audio Engine
            </button>
        </div>
      )}

      <div ref={canvasRef} className="border-2 border-yellow-400 rounded-md shadow-lg h-[150px] bg-gray-800" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Oscillator Type Selector */}
        <div>
          <label htmlFor="oscillatorType" className="block mb-1 text-sm font-medium text-yellow-300">Oscillator Waveform</label>
          <select
            id="oscillatorType"
            value={oscillatorType}
            onChange={(e) => setOscillatorType(e.target.value)}
            disabled={!audioStarted}
            className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-yellow-500 focus:border-yellow-500 block w-full p-2.5 transition-colors disabled:opacity-50"
          >
            <option value="sine">Sine</option>
            <option value="square">Square</option>
            <option value="sawtooth">Sawtooth</option>
            <option value="triangle">Triangle</option>
            {/* <option value="pulse">Pulse (requires width control)</option> */}
          </select>
        </div>

        {/* Gate Mode Toggle */}
        <div className="flex items-center space-x-3 self-end mb-1">
            <input
                type="checkbox"
                checked={gateMode}
                onChange={(e) => setGateMode(e.target.checked)}
                disabled={!audioStarted}
                id="gateModeToggle"
                className="h-5 w-5 text-yellow-400 border-gray-500 rounded focus:ring-yellow-500 accent-yellow-400 disabled:opacity-50"
            />
            <label htmlFor="gateModeToggle" className={`text-yellow-300 font-medium ${!audioStarted ? 'opacity-50' : ''}`}>
                Gate Mode (Legato/Sustain)
            </label>
        </div>
      </div>


      <fieldset className="border border-gray-700 p-3 rounded-md">
        <legend className="text-yellow-300 px-1 text-sm">Envelope (ADSR)</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
            {[
            { label: "Attack", value: attack, setter: setAttack, min:0.005, max:2, step:0.005 },
            { label: "Decay", value: decay, setter: setDecay, min:0.005, max:2, step:0.005 },
            { label: "Sustain", value: sustain, setter: setSustain, min:0.0, max:1, step:0.01 },
            { label: "Release", value: release, setter: setRelease, min:0.005, max:3, step:0.005 },
            ].map(ctrl => (
            <label key={ctrl.label} className="flex flex-col text-xs">
                {ctrl.label} ({ctrl.value.toFixed(ctrl.label === 'Sustain' ? 2 : 3)}s)
                <input type="range" min={ctrl.min} max={ctrl.max} step={ctrl.step} value={ctrl.value}
                disabled={!audioStarted}
                onChange={(e) => ctrl.setter(+e.target.value)}
                className={`mt-1 h-2 accent-yellow-400 bg-gray-600 rounded-lg appearance-none cursor-pointer disabled:opacity-50 ${!audioStarted ? 'cursor-not-allowed' : ''}`} />
            </label>
            ))}
        </div>
      </fieldset>


      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <fieldset className="border border-gray-700 p-3 rounded-md">
            <legend className="text-yellow-300 px-1 text-sm">Distortion</legend>
            <div className="space-y-3">
            {[
                {label: "Gain", value: distortionAmount, setter: setDistortionAmount, min:0, max:1, step:0.01, displayFactor: 100, unit: "%"}, // p5.Distortion amount is 0-1
                {label: "Dry/Wet", value: distortionDryWet, setter: setDistortionDryWet, min:0, max:1, step:0.01, displayFactor: 100, unit: "%"}
            ].map(ctrl => (
                <label key={ctrl.label} className="flex flex-col text-xs">
                {ctrl.label} ({(ctrl.value * (ctrl.displayFactor || 1)).toFixed(0)}{ctrl.unit || ""})
                <input type="range" min={ctrl.min} max={ctrl.max} step={ctrl.step} value={ctrl.value}
                    disabled={!audioStarted}
                    onChange={(e) => ctrl.setter(+e.target.value)}
                    className={`mt-1 h-2 accent-yellow-400 bg-gray-600 rounded-lg appearance-none cursor-pointer disabled:opacity-50 ${!audioStarted ? 'cursor-not-allowed' : ''}`} />
                </label>
            ))}
            </div>
        </fieldset>

        <fieldset className="border border-gray-700 p-3 rounded-md">
            <legend className="text-yellow-300 px-1 text-sm">Delay</legend>
            <div className="space-y-3">
            {[
                {label: "Time", value: delayTime, setter: setDelayTime, min:0, max:1, step:0.01, unit: "s"},
                {label: "Feedback", value: delayFeedback, setter: setDelayFeedback, min:0, max:0.95, step:0.01, displayFactor: 100, unit: "%"}, // Max feedback < 1
                {label: "Filter LP", value: delayFilter, setter: setDelayFilter, min:100, max:10000, step:10, unit: "Hz"}
            ].map(ctrl => (
                <label key={ctrl.label} className="flex flex-col text-xs">
                {ctrl.label} ({(ctrl.value * (ctrl.displayFactor || 1)).toFixed(ctrl.label === 'Feedback' || ctrl.label === 'Time' ? (ctrl.label === 'Time' ? 2 : 0) : 0)}{ctrl.unit})
                <input type="range" min={ctrl.min} max={ctrl.max} step={ctrl.step} value={ctrl.value}
                    disabled={!audioStarted}
                    onChange={(e) => ctrl.setter(+e.target.value)}
                    className={`mt-1 h-2 accent-yellow-400 bg-gray-600 rounded-lg appearance-none cursor-pointer disabled:opacity-50 ${!audioStarted ? 'cursor-not-allowed' : ''}`} />
                </label>
            ))}
            </div>
        </fieldset>

        <fieldset className="border border-gray-700 p-3 rounded-md">
            <legend className="text-yellow-300 px-1 text-sm">Reverb</legend>
            <div className="space-y-3">
            {[
                {label: "Time", value: reverbTime, setter: setReverbTime, min:0, max:10, step:0.1, unit: "s"},
                {label: "Decay Rate", value: reverbDecay, setter: setReverbDecay, min:0, max:10, step:0.1, displayFactor:10, unit: "%"}, // Decay Rate 0-100 for p5
                {label: "Dry/Wet", value: reverbDryWet, setter: setReverbDryWet, min:0, max:1, step:0.01, displayFactor: 100, unit: "%"}
            ].map(ctrl => (
                <label key={ctrl.label} className="flex flex-col text-xs">
                {ctrl.label} ({(ctrl.value * (ctrl.displayFactor || 1)).toFixed(0)}{ctrl.unit})
                <input type="range" min={ctrl.min} max={ctrl.max} step={ctrl.step} value={ctrl.value}
                    disabled={!audioStarted}
                    onChange={(e) => ctrl.setter(+e.target.value)}
                    className={`mt-1 h-2 accent-yellow-400 bg-gray-600 rounded-lg appearance-none cursor-pointer disabled:opacity-50 ${!audioStarted ? 'cursor-not-allowed' : ''}`} />
                </label>
            ))}
            </div>
        </fieldset>
      </div>


      <div className="flex items-center justify-center space-x-4 mt-4">
        <button
            className={`bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-md font-semibold shadow transition-colors disabled:opacity-50 ${!audioStarted ? 'cursor-not-allowed' : ''}`}
            onClick={() => setOctave(o => Math.max(0, o - 1))}
            disabled={!audioStarted}
        >
            Octave Down
        </button>
        <span className={`text-yellow-300 text-lg font-medium tabular-nums ${!audioStarted ? 'opacity-50' : ''}`}>Octave: {octave}</span>
        <button
            className={`bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-md font-semibold shadow transition-colors disabled:opacity-50 ${!audioStarted ? 'cursor-not-allowed' : ''}`}
            onClick={() => setOctave(o => Math.min(8, o + 1))}
            disabled={!audioStarted}
        >
            Octave Up
        </button>
      </div>
      <footer className="text-center text-xs text-gray-500 pt-4 pb-2">
        MonoSynth VMI003 | p5.js + React | Current Date: {new Date().toLocaleDateString()}
      </footer>
    </div>
  );
}