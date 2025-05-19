/* global p5, userStartAudio */
import React, { useRef, useEffect, useState } from "react";

const a4ToC4 = (a4Freq) => a4Freq / Math.pow(2, 9/12);

// Define common tuning standards based on A4 frequency, including their C4 frequency
const tuningOptions = [
  { label: "A=440 Hz (Concert)", a4: 440, c4: a4ToC4(440) },
  { label: "A=432 Hz (Philosophical)", a4: 432, c4: a4ToC4(432) },
  { label: "A=415 Hz (Baroque)", a4: 415, c4: a4ToC4(415) },
  { label: "A=442 Hz (Orchestra)", a4: 442, c4: a4ToC4(442) },
  { label: "A=444 Hz (Sharper)", a4: 444, c4: a4ToC4(444) },
  { label: "A=435 Hz (French)", a4: 435, c4: a4ToC4(435) },
];


export default function SynthUI() {
  const [currentRootFreq, setCurrentRootFreq] = useState(tuningOptions[0].c4); // Default to C4 for A=440
  const [selectedTuningLabel, setSelectedTuningLabel] = useState(tuningOptions[0].label); // State to drive dropdown

  // Define scales using frequency ratios relative to the root
  const scales = {
    major: [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8, 2, 9 / 4, 5 / 2],
    naturalMinor: [1, 9 / 8, 6 / 5, 4 / 3, 3 / 2, 8 / 5, 9 / 5, 2, 9 / 4, 12 / 5],
    harmonicMinor: [1, 9 / 8, 6 / 5, 4 / 3, 3 / 2, 8 / 5, 15 / 8, 2, 9 / 4, 12 / 5],
    melodicMinor: [1, 9 / 8, 6 / 5, 4 / 3, 3 / 2, 5 / 3, 15 / 8, 2, 9 / 4, 12 / 5],
    dorian: [1, 9 / 8, 6 / 5, 4 / 3, 3 / 2, 5 / 3, 9 / 5, 2, 9 / 4, 12 / 5],
    phrygian: [1, 16 / 15, 6 / 5, 4 / 3, 3 / 2, 8 / 5, 9 / 5, 2, 32 / 15, 12 / 5],
    lydian: [1, 9 / 8, 5 / 4, 45 / 32, 3 / 2, 5 / 3, 15 / 8, 2, 9 / 4, 5 / 2],
    mixolydian: [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 9 / 5, 2, 9 / 4, 5 / 2],
    aeolian: [1, 9 / 8, 6 / 5, 4 / 3, 3 / 2, 8 / 5, 9 / 5, 2, 9 / 4, 12 / 5], // Same as Natural Minor
    locrian: [1, 16 / 15, 6 / 5, 4 / 3, 64 / 45, 8 / 5, 9 / 5, 2, 32 / 15, 12 / 5],
  };

  // Keyboard key mapping to scale degrees (0-indexed)
  const keyMap = {
    lower: "zxcvbnmöç.", // Maps to scale degrees 0-6
    middle: "asdfghjklş", // Maps to scale degrees 0-6
    upper: "qwertyuıop", // Maps to scale degrees 0-6 (Changed from ı to u for standard keys)
  };

  const getKeyInfo = (key) => {
    const lowerKey = key.toLowerCase(); // Handle caps lock
    if (keyMap.lower.includes(lowerKey))
      return { index: keyMap.lower.indexOf(lowerKey), octaveShift: -1 };
    if (keyMap.middle.includes(lowerKey))
      return { index: keyMap.middle.indexOf(lowerKey), octaveShift: 0 };
    if (keyMap.upper.includes(lowerKey))
      return { index: keyMap.upper.indexOf(lowerKey), octaveShift: 1 };
    return null;
  };

  const canvasRef = useRef(null);
  const oscRef = useRef(null);
  const envRef = useRef(null);
  const reverbRef = useRef(null);
  const delayRef = useRef(null);
  const distortionRef = useRef(null);
  const fftRef = useRef(null);
  const p5InstanceRef = useRef(null); // To store p5 instance for cleanup

  const pressedKeysRef = useRef(new Set());
  const midiHeldNotesRef = useRef(new Set());

  // ADSR
  const [attack, setAttack] = useState(0.05);
  const [decay, setDecay] = useState(0.1);
  const [sustain, setSustain] = useState(0.2); // Default sustain level (0 to 1)
  const [release, setRelease] = useState(0.15);

  // Oscillator
  const [oscillatorType, setOscillatorType] = useState("sine");

  // Octave
  const [octave, setOctave] = useState(4);

  // Scale Selection
  const [selectedScale, setSelectedScale] = useState("major"); // State for selected scale

  // Reverb
  const [reverbTime, setReverbTime] = useState(0.0);
  const [reverbDryWet, setReverbDryWet] = useState(0.0);
  const [reverbDecay, setReverbDecay] = useState(0.0); // This is decay rate for p5.Reverb

  // Delay
  const [delayTime, setDelayTime] = useState(0);
  const [delayFeedback, setDelayFeedback] = useState(0);
  const [delayFilter, setDelayFilter] = useState(2300);

  // Distortion
  const [distortionAmount, setDistortionAmount] = useState(0.0);
  const [distortionDryWet, setDistortionDryWet] = useState(0.0);

  // Audio Start
  const [audioStarted, setAudioStarted] = useState(false);
  // Gate Mode state removed

  // p5.js sketch effect
  useEffect(() => {
    if (!audioStarted) return;

    const sketch = (p) => {
      p.setup = () => {
        p.createCanvas(1200, 300).parent(canvasRef.current);
        p.background(30); // Initial background draw

        envRef.current = new p5.Envelope();
        envRef.current.setADSR(attack, decay, sustain, release);
        envRef.current.setRange(0.5, 0);

        oscRef.current = new p5.Oscillator(oscillatorType);
        oscRef.current.amp(envRef.current);
        oscRef.current.start();
        oscRef.current.amp(0);

        distortionRef.current = new p5.Distortion();
        distortionRef.current.process(oscRef.current, distortionAmount, 'none');
        distortionRef.current.drywet(distortionDryWet);

        delayRef.current = new p5.Delay();
        delayRef.current.process(distortionRef.current, delayTime, delayFeedback, delayFilter);
        delayRef.current.process(oscRef.current, delayTime, delayFeedback, delayFilter);


        reverbRef.current = new p5.Reverb();
        reverbRef.current.process(delayRef.current, reverbTime, reverbDecay);
        reverbRef.current.process(distortionRef.current, reverbTime, reverbDecay);
        reverbRef.current.process(oscRef.current, reverbTime, reverbDecay);
        reverbRef.current.drywet(reverbDryWet);

        fftRef.current = new p5.FFT();
        fftRef.current.setInput(oscRef.current);
        fftRef.current.setInput(distortionRef.current);
        fftRef.current.setInput(delayRef.current);
        fftRef.current.setInput(reverbRef.current);
      };

      p.draw = () => {
        p.background(30);
        const halfWidth = p.width / 2;

        if (fftRef.current) {
          const waveform = fftRef.current.waveform();
          p.stroke(255);
          p.noFill();
          p.beginShape();
          for (let i = 0; i < waveform.length; i++) {
            const x = p.map(i, 0, waveform.length, 0, halfWidth - 20);
            const y = p.map(waveform[i], -1, 1, p.height-20, 20);
            p.vertex(x, y);
          }
          p.endShape();

          const spectrum = fftRef.current.analyze();
          p.noStroke();
          p.fill("#f5ef71");
          const spectrumDisplayWidth = halfWidth - 20 - (p.width - (halfWidth + 20));
          const spectrumBarWidth = (halfWidth - 40) / spectrum.length;

          for (let i = 0; i < spectrum.length; i++) {
            const x = p.map(
              i,
              0,
              spectrum.length,
              halfWidth + 20,
              p.width - 20
            );
            const h = p.map(spectrum[i], 0, 255, 0, -p.height);
            p.rect(x, p.height, spectrumBarWidth, h);
          }
        }
      };
      p5InstanceRef.current = p; // Store p5 instance
    };

    const myp5 = new p5(sketch);

    return () => {
      if (oscRef.current) {
        oscRef.current.stop();
        oscRef.current.disconnect();
      }
      if (envRef.current && typeof envRef.current.dispose === 'function') envRef.current.dispose();
      if (reverbRef.current && typeof reverbRef.current.dispose === 'function') reverbRef.current.dispose();
      if (delayRef.current && typeof delayRef.current.dispose === 'function') delayRef.current.dispose();
      if (distortionRef.current && typeof distortionRef.current.dispose === 'function') distortionRef.current.dispose();
      if (fftRef.current && typeof fftRef.current.dispose === 'function') fftRef.current.dispose();

      myp5.remove(); // Clean up the p5 sketch
      p5InstanceRef.current = null;
    };
    // Re-run effect only when audioStarted changes
  }, [audioStarted]); // Removed gateMode from dependencies

  // Effect for updating oscillator type
  useEffect(() => {
    if (audioStarted && oscRef.current && oscRef.current.setType) {
      oscRef.current.setType(oscillatorType);
    }
  }, [oscillatorType, audioStarted]);

  // Effect for ADSR updates
  useEffect(() => {
    if (envRef.current && audioStarted) {
      envRef.current.setADSR(attack, decay, sustain, release);
      envRef.current.setRange(0.5, 0); // Ensure range is set consistently
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
      reverbRef.current.set(reverbTime, reverbDecay);
      reverbRef.current.drywet(reverbDryWet);
    }
  }, [reverbTime, reverbDecay, reverbDryWet, audioStarted]);

  // Effect for Distortion updates
  useEffect(() => {
    if (distortionRef.current && audioStarted) {
       distortionRef.current.set(distortionAmount, "2x");
       distortionRef.current.drywet(distortionDryWet);
    }
  }, [distortionAmount, distortionDryWet, audioStarted]);


  // Keyboard event listeners
  useEffect(() => {
    if (!audioStarted) return;

    const handleKeyDown = (e) => {
      if (!oscRef.current || !envRef.current) return;
      if (pressedKeysRef.current.has(e.key.toLowerCase())) return;


      const keyInfo = getKeyInfo(e.key);
      if (!keyInfo) return;

       // Use the selected scale ratios
      const scaleRatios = scales[selectedScale];
      if (!scaleRatios || keyInfo.index >= scaleRatios.length) {
        console.warn("Invalid scale index or scale data missing.");
        return;
      }

      pressedKeysRef.current.add(e.key.toLowerCase());
      // Calculate frequency based on selected scale
      const freq = currentRootFreq * scaleRatios[keyInfo.index] * Math.pow(2, (octave + keyInfo.octaveShift) - 4);

      // Simplified logic: always trigger attack on key down
      oscRef.current.freq(freq); // Set frequency immediately
      envRef.current.triggerAttack(oscRef.current); // Trigger envelope attack


    };

    const handleKeyUp = (e) => {
      if (!oscRef.current || !envRef.current || !pressedKeysRef.current.has(e.key.toLowerCase())) return;

      pressedKeysRef.current.delete(e.key.toLowerCase());

      // Simplified logic: trigger release only when NO keys are held
      if (pressedKeysRef.current.size === 0) {
          envRef.current.triggerRelease(oscRef.current);
      }
      // Note: In this simplified mode, quickly pressing and releasing multiple keys might
      // not re-trigger the envelope for subsequent held keys. The envelope is only
      // triggered ONCE on the *first* key down and released ONCE on the *last* key up.
      // If you want each key press/release to manage its own voice/envelope, you'd
      // need a polyphonic synth or more complex monophonic voice management.
      // Sticking to the simplified monophonic trigger pattern as implied by removing gate mode.
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
     // Update dependencies
  }, [audioStarted, octave, selectedScale, currentRootFreq, envRef, oscRef, attack, sustain, release]);


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
      const command = status & 0xf0;
      // MIDI uses standard chromatic scale. Scale selection only applies to keyboard.
      const freq = 440 * Math.pow(2, (note - 69) / 12);

      if (command === 0x90 && velocity > 0) {
        midiHeldNotesRef.current.add(note);

        // Simplified logic: always trigger attack on MIDI note on
        oscRef.current.freq(freq); // Set frequency immediately
        envRef.current.triggerAttack(oscRef.current); // Trigger envelope attack

      } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
        midiHeldNotesRef.current.delete(note);

        // Simplified logic: trigger release only when NO MIDI notes are held
        if (midiHeldNotesRef.current.size === 0) {
          envRef.current.triggerRelease(oscRef.current);
        }
         // Similar note as keyboard: monophonic triggering means release only on last note off.
      }
    };

    navigator.requestMIDIAccess()
      .then((midi) => {
        midiAccessInstance = midi;
        for (let input of midiAccessInstance.inputs.values()) {
          input.onmidimessage = onMIDIMessage;
        }
        midiAccessInstance.onstatechange = (event) => {
            console.log("MIDI state change:", event.port.name, event.port.manufacturer, event.port.state);
            for (let input of midiAccessInstance.inputs.values()) { // Re-attach listeners
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
          input.onmidimessage = null;
        }
      }
    };
     // Update dependencies
  }, [audioStarted, envRef, oscRef, attack, sustain, release]); // Removed gateMode from dependencies

  const startAudioContext = async () => {
    try {
      if (typeof p5.prototype.userStartAudio === 'function') {
        await p5.prototype.userStartAudio();
      } else if (p5InstanceRef.current && typeof p5InstanceRef.current.userStartAudio === 'function') {
        await p5InstanceRef.current.userStartAudio();
      } else {
        const tempP5 = new p5(() => {});
        await tempP5.userStartAudio();
        tempP5.remove();
      }
      setAudioStarted(true);
      console.log("Audio context started successfully.");
    } catch (e) {
      console.error("Error starting audio context:", e);
      alert("Could not start audio. Please check browser permissions.");
    }
  };

   // Handler for tuning selection change
   const handleTuningChange = (event) => {
    const selectedLabel = event.target.value;
    setSelectedTuningLabel(selectedLabel);
    const selectedOption = tuningOptions.find(opt => opt.label === selectedLabel);
    if (selectedOption) {
      setCurrentRootFreq(selectedOption.c4);
      console.log(`Tuning changed to ${selectedLabel}. New C4 frequency: ${selectedOption.c4.toFixed(3)} Hz`);
    }
  };


  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6 text-white bg-gray-900 min-h-screen font-sans"> {/* Increased max-width for tuning dropdown */}
      <h1 className="text-3xl font-bold text-yellow-400 text-center">MonoSynth VMI003</h1>

      {!audioStarted && (
        <div className="text-center py-8"> {/* Added padding */}
            <p className="mb-4 text-gray-300">Click the button below to enable audio. This is required by modern browsers.</p>
            <button
            className="bg-green-500 hover:bg-green-600 text-black px-8 py-4 rounded-lg text-xl font-semibold shadow-lg transition-colors active:bg-green-700" // Larger button
            onClick={startAudioContext}
            >
            Start Audio Engine
            </button>
            <p className="mt-4 text-sm text-gray-400">If starting audio fails, ensure browser permissions are granted.</p>
        </div>
      )}
      {/* Canvas height from the provided code, added overflow-hidden */}
      <div ref={canvasRef} className={`border-2 border-yellow-400 rounded-md shadow-lg bg-gray-800 mx-auto relative overflow-hidden ${!audioStarted ? 'opacity-50' : ''}`} style={{width: '100%', maxWidth: '1200px', height: '300px'}} >
         {!audioStarted && (
               // Overlay text when audio is not started
               <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-lg p-4 text-center">
                   Visualization active when audio engine is started. Click 'Start Audio Engine' above.
               </div>
           )}
      </div>


      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {/* Carrier Waveform */}
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
          </select>
        </div>

         {/* Scale Selection Dropdown */}
         <div>
          <label
            htmlFor="scaleType"
            className="block mb-1 text-sm font-medium text-yellow-300"
          >
            Keyboard Scale
          </label>
          <select
            id="scaleType"
            value={selectedScale}
            onChange={(e) => setSelectedScale(e.target.value)}
            disabled={!audioStarted}
            className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-yellow-500 focus:border-yellow-500 block w-full p-2.5 transition-colors disabled:opacity-50"
          >
            {Object.keys(scales).map((scaleKey) => (
              <option key={scaleKey} value={scaleKey}>
                {scaleKey.charAt(0).toUpperCase() + scaleKey.slice(1).replace(/([A-Z])/g, ' $1').trim()} {/* Formats camelCase to human readable */}
              </option>
            ))}
          </select>
        </div>

         {/* === TUNING SELECTION DROPDOWN === */}
         <div>
          <label
            htmlFor="tuningType" // Link label to select by id
            className="block mb-1 text-sm font-medium text-yellow-300"
          >
            Tuning Standard (A4)
          </label>
          <select
            id="tuningType" // Corresponding id for label
            value={selectedTuningLabel} // Bind value to state
            onChange={handleTuningChange} // Call handler on change
            disabled={!audioStarted}
            className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-yellow-500 focus:border-yellow-500 block w-full p-2.5 transition-colors disabled:opacity-50"
          >
            {tuningOptions.map((option) => (
              <option key={option.label} value={option.label}> {/* Use label as key and value */}
                {option.label} {/* Display the label */}
              </option>
            ))}
          </select>
        </div>
        {/* ================================== */}

      </div> {/* End Controls Grid 1 */}


      {/* Envelope */}
      <fieldset className="border border-gray-700 p-3 rounded-md">
        <legend className="text-yellow-300 px-1 text-sm">Envelope (ADSR)</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
            {[
            { label: "Attack", value: attack, setter: setAttack, min:0.001, max:2, step:0.001 }, // Changed min from 0.005
            { label: "Decay", value: decay, setter: setDecay, min:0.001, max:2, step:0.001 }, // Changed min from 0.005
            { label: "Sustain", value: sustain, setter: setSustain, min:0.0, max:1, step:0.01 },
            { label: "Release", value: release, setter: setRelease, min:0.001, max:3, step:0.001 }, // Changed min from 0.005
            ].map(ctrl => (
            <label key={ctrl.label} className="flex flex-col text-xs">
                {ctrl.label} ({ctrl.value.toFixed(ctrl.label === 'Sustain' ? 2 : 3)}{ctrl.label === 'Sustain' ? '' : 's'})
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
                {label: "Gain", value: distortionAmount, setter: setDistortionAmount, min:0, max:1, step:0.01, displayFactor: 100, unit: "%"},
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
                {label: "Feedback", value: delayFeedback, setter: setDelayFeedback, min:0, max:0.95, step:0.01, displayFactor: 100, unit: "%"},
                {label: "Filter LP", value: delayFilter, setter: setDelayFilter, min:100, max:10000, step:10, unit: "Hz"}
            ].map(ctrl => (
                <label key={ctrl.label} className="flex flex-col text-xs">
                {ctrl.label} ({(ctrl.label === 'Filter LP' ? ctrl.value : ctrl.value * (ctrl.displayFactor || 1)).toFixed(ctrl.label === 'Feedback' || ctrl.label === 'Time' ? (ctrl.label === 'Time' ? 2 : 0) : 0)}{ctrl.unit})
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
                {label: "Decay Rate", value: reverbDecay, setter: setReverbDecay, min:0, max:1, step:0.01, displayFactor:100, unit: "%"}, // Note: p5 param is 0-1
                {label: "Dry/Wet", value: reverbDryWet, setter: setReverbDryWet, min:0, max:1, step:0.01, displayFactor: 100, unit: "%"}
            ].map(ctrl => (
                <label key={ctrl.label} className="flex flex-col text-xs">
                {ctrl.label} ({ctrl.label === 'Decay Rate' ? (ctrl.value * 100).toFixed(0) : ctrl.value.toFixed(ctrl.label === 'Time' ? 1 : 0)}{ctrl.unit})
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
            disabled={!audioStarted || octave <= 0}
        >
            Octave Down
        </button>
        <span className={`text-yellow-300 text-lg font-medium tabular-nums ${!audioStarted ? 'opacity-50' : ''}`}>Octave: {octave}</span>
        <button
            className={`bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-md font-semibold shadow transition-colors disabled:opacity-50 ${!audioStarted ? 'cursor-not-allowed' : ''}`}
            onClick={() => setOctave(o => Math.min(8, o + 1))}
            disabled={!audioStarted || octave >= 8}
        >
            Octave Up
        </button>
      </div>
       <div className="text-center text-gray-400 text-sm mt-4 space-y-2">
            <p className="font-bold text-yellow-300">Keyboard Mapping:</p>
            <p className="font-mono text-xs">Lower Octave: {keyMap.lower.split('').join(' ')}</p>
            <p className="font-mono text-xs">Middle Octave: {keyMap.middle.split('').join(' ')}</p>
            <p className="font-mono text-xs">Upper Octave: {keyMap.upper.split('').join(' ')}</p>
            <p>Note: MIDI input uses the standard chromatic scale (A4=440 Hz) and is not affected by the Tuning Standard setting.</p>
        </div>
      <footer className="text-center text-xs text-gray-500 pt-4 pb-2">
        MonoSynth VMI003 | p5.js + React | Current Date: {new Date().toLocaleDateString()}
      </footer>
    </div>
  );
}
