/* global p5 */
import React, { useRef, useEffect, useState } from "react";


export default function SynthUI() {
  const canvasRef = useRef(null);
  const oscRef = useRef(null);
  const envRef = useRef(null);

  const [attack, setAttack] = useState(0.1);
  const [decay, setDecay] = useState(0.2);
  const [sustain, setSustain] = useState(0.5);
  const [release, setRelease] = useState(0.3);
  const [octave, setOctave] = useState(4);

  const rootFreq = 261.63; // Middle C
  const scale = [1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8]; // C major: C D E F G A B
  const keys = "asdfghj";

  useEffect(() => {
    const sketch = (p) => {
      p.setup = () => {
        p.createCanvas(400, 100).parent(canvasRef.current);
        envRef.current = new p5.Envelope();
        envRef.current.setADSR(attack, decay, sustain, release);
        envRef.current.setRange(1, 0);

        oscRef.current = new p5.Oscillator("sine");
        oscRef.current.amp(envRef.current);
        oscRef.current.start();
      };

      p.draw = () => {
        p.background(30);
        p.fill(255);
        p.textSize(16);
        p.text("Use keys A-S-D-F-G-H-J to play notes", 10, 50);
      };
    };

    const myp5 = new p5(sketch);
    return () => myp5.remove();
  }, []);

  useEffect(() => {
    if (envRef.current) {
      envRef.current.setADSR(attack, decay, sustain, release);
    }
  }, [attack, decay, sustain, release]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const index = keys.indexOf(e.key);
      if (index !== -1 && oscRef.current && envRef.current) {
        const freq = rootFreq * scale[index] * Math.pow(2, octave - 4);
        oscRef.current.freq(freq);
        envRef.current.play();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [octave]);

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6 text-white bg-black min-h-screen">
      <h1 className="text-2xl font-bold text-yellow-300">Simple Synth</h1>
      <div ref={canvasRef} className="border border-yellow-400 rounded" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <label>Attack<input type="range" min="0.01" max="1" step="0.01" value={attack} onChange={(e) => setAttack(+e.target.value)} /></label>
        <label>Decay<input type="range" min="0.01" max="1" step="0.01" value={decay} onChange={(e) => setDecay(+e.target.value)} /></label>
        <label>Sustain<input type="range" min="0.01" max="1" step="0.01" value={sustain} onChange={(e) => setSustain(+e.target.value)} /></label>
        <label>Release<input type="range" min="0.01" max="1" step="0.01" value={release} onChange={(e) => setRelease(+e.target.value)} /></label>
      </div>
      <div className="space-x-4 mt-4">
        <button className="bg-yellow-300 text-black px-3 py-1 rounded" onClick={() => setOctave(o => o - 1)}>Octave Down</button>
        <button className="bg-yellow-300 text-black px-3 py-1 rounded" onClick={() => setOctave(o => o + 1)}>Octave Up</button>
        <span className="text-yellow-300">Current Octave: {octave}</span>
      </div>
    </div>
  );
}
