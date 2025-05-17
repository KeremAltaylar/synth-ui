/* global p5, userStartAudio */
import React, { useRef, useEffect, useState } from "react";

export default function SynthUI() {
  const rootFreq = 261.63;
  const scale = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8];
  const keyMap = {
    lower: "zxcvbnm",
    middle: "asdfghj",
    upper: "qwertyuı"
  };
  
  const getKeyInfo = (key) => {
    if (keyMap.lower.includes(key)) return { index: keyMap.lower.indexOf(key), octaveShift: -1 };
    if (keyMap.middle.includes(key)) return { index: keyMap.middle.indexOf(key), octaveShift: 0 };
    if (keyMap.upper.includes(key)) return { index: keyMap.upper.indexOf(key), octaveShift: 1 };
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

  const [attack, setAttack] = useState(0.1);
  const [decay, setDecay] = useState(0.1);
  const [sustain, setSustain] = useState(0.1);
  const [release, setRelease] = useState(0.1);
  const [octave, setOctave] = useState(4);
  const [reverbTime, setReverbTime] = useState(0.0);
  const [reverbDryWet, setReverbDryWet] = useState(0.0);
  const [reverbDecay, setReverbDecay] = useState(0.0);
  const [delayTime, setDelayTime] = useState(0);
  const [delayFeedback, setDelayFeedback] = useState(0);
  const [delayFilter, setDelayFilter] = useState(2300);
  const [distortionAmount, setDistortionAmount] = useState(0.0);
  const [distortionDryWet, setDistortionDryWet] = useState(0.0);
  const [audioStarted, setAudioStarted] = useState(false);
  const [gateMode, setGateMode] = useState(true);

  useEffect(() => {
    if (!audioStarted) return;

    const sketch = (p) => {
      p.setup = () => {
        p.createCanvas(600, 150).parent(canvasRef.current);

        envRef.current = new p5.Envelope();
        envRef.current.setADSR(attack, decay, sustain, release);
        envRef.current.setRange(0.3, 0);

        oscRef.current = new p5.Oscillator("sine");
        oscRef.current.start();
        oscRef.current.amp(0, 0.0001);
        oscRef.current.amp(envRef.current);

        distortionRef.current = new p5.Distortion(distortionAmount);
        distortionRef.current.process(oscRef.current);
        distortionRef.current.amp(0.2);
        distortionRef.current.drywet(distortionDryWet);

        delayRef.current = new p5.Delay();
        delayRef.current.process(oscRef.current);
        delayRef.current.process(distortionRef.current, delayTime, delayFeedback, delayFilter);
        delayRef.current.amp(1, 0.001);

        reverbRef.current = new p5.Reverb();
        reverbRef.current.process(oscRef.current);
        reverbRef.current.process(distortionRef.current);
        reverbRef.current.process(delayRef.current, reverbTime, reverbDecay);
        reverbRef.current.amp(2, 0.001);
        reverbRef.current.drywet(reverbDryWet);

        fftRef.current = new p5.FFT();
        fftRef.current.setInput(reverbRef.current);
        fftRef.current.setInput(oscRef.current);
        fftRef.current.setInput(delayRef.current);
        fftRef.current.setInput(distortionRef.current);

      };

      p.draw = () => {
        p.background(30);
        const halfWidth = p.width / 2;

        const waveform = fftRef.current.waveform();
        p.stroke(255);
        p.noFill();
        p.beginShape();
        for (let i = 0; i < waveform.length; i++) {
          const x = p.map(i, 0, waveform.length, 0, halfWidth - 40);
          const y = p.map(waveform[i], -1, 1, 0, p.height);
          p.vertex(x, y);
        }
        p.endShape();

        const spectrum = fftRef.current.analyze();
        p.noStroke();
        p.fill("#f5ef71");
        for (let i = 0; i < spectrum.length; i++) {
          const x = p.map(i, 0, spectrum.length, halfWidth + 40, p.width);
          const h = -p.height + p.map(spectrum[i], 0, 255, p.height, 0);
          p.rect(x, p.height + p.height / 10, p.width / spectrum.length, h);
        }
      };
    };

    const myp5 = new p5(sketch);
    return () => myp5.remove();
  }, [audioStarted]);

  useEffect(() => {
    if (envRef.current) envRef.current.setADSR(attack, decay, sustain, release);
  }, [attack, decay, sustain, release]);

  useEffect(() => {
    if (delayRef.current) {
      delayRef.current.delayTime(delayTime);
      delayRef.current.feedback(delayFeedback);
      delayRef.current.filter(delayFilter);
    }
  }, [delayTime, delayFeedback, delayFilter]);

  useEffect(() => {
    if (reverbRef.current) {
      reverbRef.current.set(reverbTime, reverbDecay);
      reverbRef.current.drywet(reverbDryWet);
    }
  }, [reverbTime, reverbDryWet]);

  useEffect(() => {
    if (distortionRef.current) {
      distortionRef.current.set(distortionAmount);
      distortionRef.current.drywet(distortionDryWet);
    }
  }, [distortionAmount, distortionDryWet]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const pressedKeys = pressedKeysRef.current;
      const keyInfo = getKeyInfo(e.key);
      if (!keyInfo || pressedKeys.has(e.key)) return;

      pressedKeys.add(e.key);
      const freq = rootFreq * scale[keyInfo.index] * Math.pow(2, octave + keyInfo.octaveShift - 4);

      if (gateMode) {
        if (pressedKeys.size > 1) {
          oscRef.current.freq(freq, 0.05);
        } else {
          oscRef.current.freq(freq, 0.01);
          oscRef.current.amp(0, 0.001);
          oscRef.current.amp(sustain, attack);
        }
        prevFreq.current = freq;
        currentAmpRef.current = sustain;
      } else {
        oscRef.current.freq(freq);
        envRef.current.play();
        prevFreq.current = freq;
      }
    };

    const handleKeyUp = (e) => {
      const pressedKeys = pressedKeysRef.current;
      if (!pressedKeys.has(e.key)) return;

      pressedKeys.delete(e.key);

      if (gateMode) {
        if (pressedKeys.size === 0) {
          oscRef.current.amp(0, release);
          oscRef.current.amp(0, 0.0001);
          currentAmpRef.current = 0;
        } else {
          const lastKey = Array.from(pressedKeys).slice(-1)[0];
          const keyInfo = getKeyInfo(lastKey);
          const freq = rootFreq * scale[keyInfo.index] * Math.pow(2, octave + keyInfo.octaveShift - 4);
          oscRef.current.freq(freq, 0.05);
          oscRef.current.amp(0, release);

          oscRef.current.amp(0, 0.0001);

          prevFreq.current = freq;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [octave, gateMode, attack, release, sustain]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!gateMode || !oscRef.current) return;
      if (pressedKeysRef.current.size > 0) {
        if (currentAmpRef.current !== sustain) {
          oscRef.current.amp(sustain, release);
          currentAmpRef.current = sustain;
        }
      }
    }, 150);
    return () => clearInterval(interval);
  }, [gateMode, sustain]);
  
  useEffect(() => {
    if (!navigator.requestMIDIAccess) {
      console.warn("Web MIDI API not supported in this browser.");
      return;
    }
  
    navigator.requestMIDIAccess().then((midiAccess) => {
      const onMIDIMessage = (event) => {
        const held = midiHeldNotesRef.current;
        const [status, note, velocity] = event.data;
        const command = status & 0xf0;
        const freq = 440 * Math.pow(2, (note - 69) / 12);
  
        if (command === 0x90 && velocity > 0) {
          // Note On
          held.add(note);
  
          if (gateMode) {
            if (held.size > 1) {
              // Legato glide
              oscRef.current.freq(freq, 0.03);
            } else {
              // From silence: fade in cleanly
              if (currentAmpRef.current === 0) {
                oscRef.current.amp(0, 0); // Reset amp
                oscRef.current.freq(freq, 0.01);
                const safeAttack = attack < 0.03 ? 0.03 : attack;
                oscRef.current.amp(0, 0.0001);

                oscRef.current.amp(sustain, safeAttack);
              } else {
                oscRef.current.freq(freq, 0.01);
              }
            }
            currentAmpRef.current = sustain;
          } else {
            oscRef.current.freq(freq);
            envRef.current.play();
          }
  
          prevFreq.current = freq;
  
        } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
          // Note Off
          held.delete(note);
  
          if (gateMode) {
            if (held.size === 0) {
              const safeRelease = release < 0.03 ? 0.03 : release;
              oscRef.current.amp(0, safeRelease);
              currentAmpRef.current = 0;
            } else {
              const lastNote = Array.from(held).slice(-1)[0];
              const newFreq = 440 * Math.pow(2, (lastNote - 69) / 12);
              oscRef.current.freq(newFreq, 0.03);
              prevFreq.current = newFreq;
            }
          }
        }
      };
  
      for (let input of midiAccess.inputs.values()) {
        input.onmidimessage = onMIDIMessage;
      }
    }).catch((err) => {
      console.error("MIDI access error", err);
    });
  }, [gateMode, attack, release, sustain]);
  
  
  
  

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6 text-white bg-black min-h-screen">
      <h1 className="text-2xl font-bold text-yellow-300">MonoSynth VMI003</h1>

      {!audioStarted && (
        <button
          className="bg-green-500 text-black px-4 py-2 rounded"
          onClick={() => {
            p5.prototype.userStartAudio();
            setAudioStarted(true);
          }}
        >
          Start Audio
        </button>
      )}

      <div ref={canvasRef} className="border border-yellow-400 rounded" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <label>Attack<input type="range" min="0.01" max="0.3" step="0.01" value={attack} onChange={(e) => setAttack(+e.target.value)} /></label>
        <label>Decay<input type="range" min="0.01" max="0.3" step="0.01" value={decay} onChange={(e) => setDecay(+e.target.value)} /></label>
        <label>Sustain<input type="range" min="0.01" max="0.3" step="0.01" value={sustain} onChange={(e) => setSustain(+e.target.value)} /></label>
        <label>Release<input type="range" min="0.01" max="0.3" step="0.01" value={release} onChange={(e) => setRelease(+e.target.value)} /></label>
        <label>Reverb Time<input type="range" min="0" max="9.99" step="0.1" value={reverbTime} onChange={(e) => setReverbTime(+e.target.value)} /></label>
        <label>Reverb Decay<input type="range" min="0" max="9.99" step="0.1" value={reverbDecay} onChange={(e) => setReverbDecay(+e.target.value)} /></label>
        <label>Reverb Dry/Wet<input type="range" min="0" max="1" step="0.01" value={reverbDryWet} onChange={(e) => setReverbDryWet(+e.target.value)} /></label>
        <label>Delay Time<input type="range" min="0" max="1" step="0.01" value={delayTime} onChange={(e) => setDelayTime(+e.target.value)} /></label>
        <label>Delay Feedback<input type="range" min="0" max="0.80" step="0.01" value={delayFeedback} onChange={(e) => setDelayFeedback(+e.target.value)} /></label>
        <label>Delay Filter<input type="range" min="100" max="10000" step="10" value={delayFilter} onChange={(e) => setDelayFilter(+e.target.value)} /></label>
        <label>Distortion Gain<input type="range" min="0" max="3" step="0.01" value={distortionAmount} onChange={(e) => setDistortionAmount(+e.target.value)} /></label>
        <label>Distortion Dry/wet<input type="range" min="0" max="1" step="0.01" value={distortionDryWet} onChange={(e) => setDistortionDryWet(+e.target.value)} /></label>
      </div>

      <div className="mt-4 flex items-center space-x-3">
        <input type="checkbox" checked={gateMode} onChange={(e) => setGateMode(e.target.checked)} id="gateModeToggle" />
        <label htmlFor="gateModeToggle" className="text-yellow-300 font-medium">
          Gate Mode (Hold to Sustain)
        </label>
      </div>

      <div className="space-x-4 mt-4">
        <button className="bg-yellow-300 text-black px-3 py-1 rounded" onClick={() => setOctave(o => o - 1)}>Octave Down</button>
        <button className="bg-yellow-300 text-black px-3 py-1 rounded" onClick={() => setOctave(o => o + 1)}>Octave Up</button>
        <span className="text-yellow-300">Current Octave: {octave}</span>
      </div>
    </div>
  );
}