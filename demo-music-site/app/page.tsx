"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  Check,
  Download,
  Headphones,
  Link2,
  Pause,
  Play,
  Plus,
  Share2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

type Track = {
  id: string;
  title: string;
  genre: string;
  bpm: string;
  key: string;
  duration: string;
  audio?: string;
  coverUrl?: string;
  description: string;
};

type Project = {
  id: string;
  name: string;
  tracks: Track[];
};

const STORAGE_KEY = "demo-projects-v1";
const CLIP_LENGTH = 30;

const coverClasses = [
  "cover-sunset",
  "cover-purple",
  "cover-blue",
  "cover-orange",
  "cover-green",
];

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [activeTrackId, setActiveTrackId] = useState("");

  const [hydrated, setHydrated] = useState(false);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  const [clipStart, setClipStart] = useState(0);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  const [projectName, setProjectName] = useState("");

  const [notice, setNotice] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [bpm, setBpm] = useState("");
  const [key, setKey] = useState("");
  const [genre, setGenre] = useState("Other");

  const [pendingAudioUrl, setPendingAudioUrl] = useState("");
  const [pendingAudioDuration, setPendingAudioDuration] = useState(0);
  const [pendingCoverUrl, setPendingCoverUrl] = useState("");

  const [videoBusy, setVideoBusy] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoReady, setVideoReady] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const coverImageRef = useRef<HTMLImageElement | null>(null);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );

  const tracks = activeProject?.tracks ?? [];

  const activeTrack = useMemo(
    () =>
      tracks.find((track) => track.id === activeTrackId) ??
      tracks[0] ??
      null,
    [tracks, activeTrackId]
  );

  const maxClipStart = Math.max(0, audioDuration - CLIP_LENGTH);
  const clipEnd = Math.min(clipStart + CLIP_LENGTH, audioDuration);

  /* ---------------- Load projects ---------------- */

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved) as Project[];

        if (Array.isArray(parsed)) {
          setProjects(parsed);

          if (parsed.length > 0) {
            setActiveProjectId(parsed[0].id);

            if (parsed[0].tracks.length > 0) {
              setActiveTrackId(parsed[0].tracks[0].id);
            }
          }
        }
      }
    } catch {
      console.error("Could not load saved projects.");
    }

    setHydrated(true);
  }, []);

  /* ---------------- Save project metadata ---------------- */

  useEffect(() => {
    if (!hydrated) return;

    const metadataOnly = projects.map((project) => ({
      ...project,
      tracks: project.tracks.map((track) => ({
        ...track,
        audio: undefined,
        coverUrl: undefined,
      })),
    }));

    localStorage.setItem(STORAGE_KEY, JSON.stringify(metadataOnly));
  }, [projects, hydrated]);

  /* ---------------- Active track ---------------- */

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setAudioDuration(0);
    setClipStart(0);
    setVideoReady(false);

    const audio = audioRef.current;

    if (audio) {
      audio.pause();

      if (activeTrack?.audio) {
        audio.src = activeTrack.audio;
        audio.load();
      } else {
        audio.removeAttribute("src");
        audio.load();
      }
    }

    if (activeTrack?.coverUrl) {
      const image = new Image();

      image.onload = () => {
        coverImageRef.current = image;
      };

      image.src = activeTrack.coverUrl;
    } else {
      coverImageRef.current = null;
    }
  }, [activeTrack?.id]);

  /* ---------------- Helpers ---------------- */

  function updateActiveTrack(patch: Partial<Track>) {
    if (!activeProjectId || !activeTrack) return;

    setProjects((previous) =>
      previous.map((project) => {
        if (project.id !== activeProjectId) return project;

        return {
          ...project,
          tracks: project.tracks.map((track) =>
            track.id === activeTrack.id
              ? { ...track, ...patch }
              : track
          ),
        };
      })
    );
  }

  function selectProject(id: string) {
    setActiveProjectId(id);

    const project = projects.find((item) => item.id === id);

    if (project?.tracks.length) {
      setActiveTrackId(project.tracks[0].id);
    } else {
      setActiveTrackId("");
    }

    setNotice("");
  }

  function selectTrack(id: string) {
    setActiveTrackId(id);
    setNotice("");
  }

  /* ---------------- Project creation ---------------- */

  function createProject() {
    const cleanName = projectName.trim();

    if (!cleanName) {
      setNotice("Give your project a name first.");
      return;
    }

    const newProject: Project = {
      id: makeId(),
      name: cleanName,
      tracks: [],
    };

    setProjects((previous) => [...previous, newProject]);
    setActiveProjectId(newProject.id);
    setActiveTrackId("");

    setProjectName("");
    setProjectOpen(false);
    setNotice(`Project "${cleanName}" created.`);
  }

  /* ---------------- Audio upload ---------------- */

  function onAudioUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    const url = URL.createObjectURL(file);
    setPendingAudioUrl(url);

    const tempAudio = new Audio();

    tempAudio.onloadedmetadata = () => {
      const duration = Number.isFinite(tempAudio.duration)
        ? tempAudio.duration
        : 0;

      setPendingAudioDuration(duration);
    };

    tempAudio.src = url;
  }

  function onCoverUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    const url = URL.createObjectURL(file);
    setPendingCoverUrl(url);
  }

  /* ---------------- Add track ---------------- */

  function addTrack() {
    if (!activeProject) {
      setNotice("Create a project first.");
      return;
    }

    if (!title.trim()) {
      setNotice("Add a track title.");
      return;
    }

    if (!pendingAudioUrl) {
      setNotice("Choose an audio file first.");
      return;
    }

    const newTrack: Track = {
      id: makeId(),
      title: title.trim(),
      description: description.trim(),
      genre,
      bpm: bpm.trim() || "—",
      key: key.trim() || "—",
      duration: formatTime(pendingAudioDuration),
      audio: pendingAudioUrl,
      coverUrl: pendingCoverUrl || undefined,
    };

    setProjects((previous) =>
      previous.map((project) =>
        project.id === activeProject.id
          ? {
              ...project,
              tracks: [...project.tracks, newTrack],
            }
          : project
      )
    );

    setActiveTrackId(newTrack.id);

    setTitle("");
    setDescription("");
    setGenre("Other");
    setBpm("");
    setKey("");
    setPendingAudioUrl("");
    setPendingAudioDuration(0);
    setPendingCoverUrl("");

    setUploadOpen(false);
    setNotice("Track added to your project.");
  }

  /* ---------------- Audio events ---------------- */

  function handleMetadata() {
    const audio = audioRef.current;

    if (!audio) return;

    const duration = Number.isFinite(audio.duration)
      ? audio.duration
      : 0;

    setAudioDuration(duration);

    setClipStart((current) =>
      Math.min(current, Math.max(0, duration - CLIP_LENGTH))
    );
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;

    if (!audio) return;

    setCurrentTime(audio.currentTime);

    if (
      playing &&
      audioDuration >= CLIP_LENGTH &&
      audio.currentTime >= clipStart + CLIP_LENGTH
    ) {
      audio.pause();
      audio.currentTime = clipStart;
      setPlaying(false);
    }
  }

  async function togglePlay() {
    const audio = audioRef.current;

    if (!audio) return;

    if (!activeTrack?.audio) {
      setNotice("This track needs its audio file uploaded again.");
      return;
    }

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    if (
      audio.currentTime < clipStart ||
      audio.currentTime >= clipStart + CLIP_LENGTH
    ) {
      audio.currentTime = clipStart;
    }

    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setNotice("The audio could not be played.");
    }
  }

  function changeClipStart(value: number) {
    const next = Math.max(
      0,
      Math.min(value, Math.max(0, audioDuration - CLIP_LENGTH))
    );

    setClipStart(next);

    const audio = audioRef.current;

    if (audio) {
      audio.currentTime = next;
    }
  }

  /* ---------------- Video frame ---------------- */

  function drawVideoFrame(elapsed: number) {
    const canvas = canvasRef.current;

    if (!canvas || !activeTrack) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const width = 1080;
    const height = 1920;

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    const background = ctx.createLinearGradient(
      0,
      0,
      width,
      height
    );

    background.addColorStop(0, "#090909");
    background.addColorStop(0.5, "#151515");
    background.addColorStop(1, "#050505");

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    /* Header */

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 54px Arial";
    ctx.fillText("demo.", 80, 120);

    ctx.fillStyle = "#888888";
    ctx.font = "28px Arial";
    ctx.fillText("by vaix", 82, 165);

    /* Artwork */

    const artX = 100;
    const artY = 300;
    const artSize = 880;

    if (
      coverImageRef.current &&
      coverImageRef.current.complete
    ) {
      ctx.drawImage(
        coverImageRef.current,
        artX,
        artY,
        artSize,
        artSize
      );
    } else {
      const art = ctx.createLinearGradient(
        artX,
        artY,
        artX + artSize,
        artY + artSize
      );

      art.addColorStop(0, "#6d28d9");
      art.addColorStop(0.5, "#111827");
      art.addColorStop(1, "#0f766e");

      ctx.fillStyle = art;
      ctx.fillRect(artX, artY, artSize, artSize);

      ctx.fillStyle = "rgba(255,255,255,0.08)";

      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        ctx.arc(
          artX + 80 + i * 75,
          artY + 100 + (i % 4) * 170,
          80 + i * 3,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    /* Track info */

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 64px Arial";
    ctx.fillText(activeTrack.title.slice(0, 25), 80, 1320);

    ctx.fillStyle = "#a1a1aa";
    ctx.font = "32px Arial";
    ctx.fillText(
      `${activeTrack.genre}  •  ${activeTrack.bpm} BPM  •  ${activeTrack.key}`,
      82,
      1380
    );

    /* Waveform */

    const waveformX = 80;
    const waveformY = 1510;
    const waveformWidth = 920;
    const bars = 70;

    for (let i = 0; i < bars; i++) {
      const barHeight =
        20 +
        Math.abs(
          Math.sin(i * 1.7) * 70 +
            Math.sin(i * 0.31) * 45
        );

      const x =
        waveformX + (i / bars) * waveformWidth;

      ctx.fillStyle =
        i / bars <= elapsed / CLIP_LENGTH
          ? "#ffffff"
          : "#444444";

      ctx.fillRect(
        x,
        waveformY - barHeight / 2,
        8,
        barHeight
      );
    }

    /* Time */

    ctx.fillStyle = "#ffffff";
    ctx.font = "28px Arial";

    ctx.fillText(
      `${formatTime(elapsed)} / 0:30`,
      80,
      1640
    );

    ctx.fillStyle = "#777777";
    ctx.font = "24px Arial";

    ctx.fillText(
      "1080 × 1920  •  30 sec MP4",
      80,
      1810
    );

    ctx.fillText(
      "demo. — my edits. my sound.",
      80,
      1855
    );
  }

  /* ---------------- FFmpeg ---------------- */

  async function loadFFmpeg() {
    if (ffmpegRef.current) return ffmpegRef.current;

    const ffmpeg = new FFmpeg();

    const baseURL =
      "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";

    await ffmpeg.load({
      coreURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.js`,
        "text/javascript"
      ),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm"
      ),
    });

    ffmpegRef.current = ffmpeg;

    return ffmpeg;
  }

  function seekAudio(
    audio: HTMLAudioElement,
    time: number
  ) {
    return new Promise<void>((resolve) => {
      if (Math.abs(audio.currentTime - time) < 0.05) {
        resolve();
        return;
      }

      const handleSeeked = () => {
        audio.removeEventListener("seeked", handleSeeked);
        resolve();
      };

      audio.addEventListener("seeked", handleSeeked);
      audio.currentTime = time;
    });
  }

  /* ---------------- Generate exact 30 sec MP4 ---------------- */

  async function generateVideo() {
    const audio = audioRef.current;
    const canvas = canvasRef.current;

    if (!audio || !canvas || !activeTrack) {
      setNotice("Select a track first.");
      return;
    }

    if (!activeTrack.audio) {
      setNotice("This track needs its audio file uploaded again.");
      return;
    }

    if (audioDuration < CLIP_LENGTH) {
      setNotice("The track must be at least 30 seconds long.");
      return;
    }

    if (!("MediaRecorder" in window)) {
      setNotice("Your browser does not support video recording.");
      return;
    }

    setVideoBusy(true);
    setVideoProgress(5);
    setVideoReady(false);

    const previousTime = audio.currentTime;
    const wasPlaying = !audio.paused;

    try {
      drawVideoFrame(0);

      await seekAudio(audio, clipStart);

      const canvasStream = canvas.captureStream(30);

      const audioStream =
        typeof (
          audio as HTMLAudioElement & {
            captureStream?: () => MediaStream;
          }
        ).captureStream === "function"
          ? (
              audio as HTMLAudioElement & {
                captureStream: () => MediaStream;
              }
            ).captureStream()
          : null;

      if (audioStream) {
        audioStream
          .getAudioTracks()
          .forEach((track) =>
            canvasStream.addTrack(track)
          );
      }

      const chunks: Blob[] = [];

      const recorder = new MediaRecorder(
        canvasStream,
        {
          mimeType: "video/webm;codecs=vp8,opus",
        }
      );

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      const recorderFinished = new Promise<void>(
        (resolve) => {
          recorder.onstop = () => resolve();
        }
      );

      recorder.start(250);

      await audio.play();
      setPlaying(true);

      const start = performance.now();

      await new Promise<void>((resolve) => {
        const render = () => {
          const elapsed = Math.min(
            (performance.now() - start) / 1000,
            CLIP_LENGTH
          );

          drawVideoFrame(elapsed);

          setVideoProgress(
            10 + (elapsed / CLIP_LENGTH) * 60
          );

          if (elapsed < CLIP_LENGTH) {
            requestAnimationFrame(render);
          } else {
            resolve();
          }
        };

        requestAnimationFrame(render);
      });

      audio.pause();
      setPlaying(false);

      recorder.stop();

      await recorderFinished;

      canvasStream
        .getTracks()
        .forEach((track) => track.stop());

      if (audioStream) {
        audioStream
          .getTracks()
          .forEach((track) => track.stop());
      }

      setVideoProgress(75);

      const webmBlob = new Blob(chunks, {
        type: "video/webm",
      });

      const ffmpeg = await loadFFmpeg();

      await ffmpeg.writeFile(
        "input.webm",
        await fetchFile(webmBlob)
      );

      setVideoProgress(82);

      await ffmpeg.exec([
        "-i",
        "input.webm",
        "-t",
        "30.000",
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-vf",
        "scale=1080:1920:force_original_aspect_ratio=disable",
        "-r",
        "30",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-ar",
        "48000",
        "-movflags",
        "+faststart",
        "output.mp4",
      ]);

      setVideoProgress(95);

      const output = await ffmpeg.readFile(
        "output.mp4"
      );

      const mp4Blob = new Blob(
        [
          output instanceof Uint8Array
            ? output
            : new Uint8Array(output as ArrayBuffer),
        ],
        { type: "video/mp4" }
      );

      const url = URL.createObjectURL(mp4Blob);

      const link = document.createElement("a");

      link.href = url;
      link.download = `demo-${activeTrack.title
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase()}-30s-1080x1920.mp4`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setVideoProgress(100);
      setVideoReady(true);
      setNotice("MP4 exported — exactly 30 seconds.");

      await ffmpeg.deleteFile("input.webm");
      await ffmpeg.deleteFile("output.mp4");

      await seekAudio(audio, previousTime);

      if (wasPlaying) {
        await audio.play();
        setPlaying(true);
      }
    } catch (error) {
      console.error(error);
      setNotice(
        "Video export failed. Try again or use Chrome."
      );
    } finally {
      setVideoBusy(false);
    }
  }

  /* ---------------- Share ---------------- */

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        window.location.href
      );

      setNotice("Link copied.");
    } catch {
      setNotice("Could not copy the link.");
    }
  }

  /* ---------------- Timeline visuals ---------------- */

  const timelineBars = Array.from(
    { length: 80 },
    (_, index) =>
      18 +
      Math.abs(
        Math.sin(index * 0.8) * 30 +
          Math.sin(index * 0.17) * 20
      )
  );

  const selectionLeft =
    audioDuration > 0
      ? (clipStart / audioDuration) * 100
      : 0;

  const selectionWidth =
    audioDuration > 0
      ? Math.min(
          100,
          (CLIP_LENGTH / audioDuration) * 100
        )
      : 100;

  /* ---------------- UI ---------------- */

  return (
    <main>
      <header className="topbar">
        <div className="wordmark">demo.</div>

        <nav>
          <a href="#home">HOME</a>
          <a href="#projects">PROJECTS</a>
          <a href="#about">ABOUT</a>
        </nav>

        <div className="profile-pill">
          <span className="profile-dot" />
          VAIX
        </div>
      </header>

      <section className="hero" id="home">
        <div className="hero-copy">
          <p className="eyebrow">
            <Sparkles size={15} />
            MUSIC WORKSPACE
          </p>

          <h1>
            Hi, I’m <span>vaix.</span>
          </h1>

          <p className="hero-description">
            This is demo. My edits. My sound.
            <br />
            A simple place to keep your tracks,
            projects and 30-second snippets.
          </p>

          <div className="hero-actions">
            <button
              className="primary-button"
              onClick={() => {
                if (!activeProject) {
                  setProjectOpen(true);
                  return;
                }

                setUploadOpen(true);
              }}
            >
              <Plus size={18} />
              Add Track
            </button>

            <button
              className="secondary-button"
              onClick={() => setProjectOpen(true)}
            >
              <Plus size={18} />
              New Project
            </button>
          </div>
        </div>

        <div className="hero-art">
          <div className="hero-art-inner">
            <AudioLines size={100} strokeWidth={1} />
          </div>
        </div>
      </section>

      {notice && (
        <div className="notice">
          <Check size={16} />
          {notice}
          <button onClick={() => setNotice("")}>
            <X size={15} />
          </button>
        </div>
      )}

      <section className="projects-section" id="projects">
        <div className="section-heading">
          <div>
            <p className="eyebrow">WORKSPACE</p>
            <h2>Project Folders</h2>
          </div>

          <button
            className="small-button"
            onClick={() => setProjectOpen(true)}
          >
            <Plus size={16} />
            New Project
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="empty-projects">
            <div className="empty-icon">
              <Headphones size={30} />
            </div>

            <h3>Create your first project</h3>

            <p>
              Keep your demos organized in simple project
              folders.
            </p>

            <button
              className="primary-button"
              onClick={() => setProjectOpen(true)}
            >
              <Plus size={18} />
              Create Project
            </button>
          </div>
        ) : (
          <div className="project-list">
            {projects.map((project) => (
              <button
                key={project.id}
                className={`project-folder ${
                  project.id === activeProjectId
                    ? "selected"
                    : ""
                }`}
                onClick={() => selectProject(project.id)}
              >
                <div className="folder-icon">
                  <span />
                </div>

                <div>
                  <strong>{project.name}</strong>
                  <small>
                    {project.tracks.length}{" "}
                    {project.tracks.length === 1
                      ? "track"
                      : "tracks"}
                  </small>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {activeProject && (
        <section className="latest">
          <div className="section-heading">
            <div>
              <p className="eyebrow">PROJECT</p>
              <h2>{activeProject.name}</h2>
            </div>

            <button
              className="small-button"
              onClick={() => setUploadOpen(true)}
            >
              <Plus size={16} />
              Add Track
            </button>
          </div>

          {tracks.length === 0 ? (
            <div className="empty-tracks">
              <AudioLines size={34} />

              <h3>No tracks yet</h3>

              <p>
                Add your first song or demo to this project.
              </p>

              <button
                className="primary-button"
                onClick={() => setUploadOpen(true)}
              >
                <Upload size={18} />
                Add Track
              </button>
            </div>
          ) : (
            <div className="track-grid">
              {tracks.map((track, index) => (
                <button
                  key={track.id}
                  className={`track-card ${
                    track.id === activeTrack?.id
                      ? "active"
                      : ""
                  }`}
                  onClick={() => selectTrack(track.id)}
                >
                  <div
                    className={`cover ${
                      track.coverUrl
                        ? "cover-uploaded"
                        : coverClasses[
                            index % coverClasses.length
                          ]
                    }`}
                    style={
                      track.coverUrl
                        ? {
                            backgroundImage: `url(${track.coverUrl})`,
                          }
                        : undefined
                    }
                  >
                    <Play size={22} />
                  </div>

                  <div className="track-card-info">
                    <strong>{track.title}</strong>

                    <span>
                      {track.genre} · {track.duration}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTrack && (
        <section className="detail-layout">
          <div className="detail-card">
            <div
              className={`detail-cover ${
                activeTrack.coverUrl
                  ? "cover-uploaded"
                  : coverClasses[
                      tracks.findIndex(
                        (track) =>
                          track.id === activeTrack.id
                      ) % coverClasses.length
                    ]
              }`}
              style={
                activeTrack.coverUrl
                  ? {
                      backgroundImage: `url(${activeTrack.coverUrl})`,
                    }
                  : undefined
              }
            >
              <div className="detail-cover-symbol">
                <AudioLines size={65} />
              </div>
            </div>

            <div className="detail-info">
              <p className="eyebrow">
                CREATED BY VAIX
              </p>

              <h2>{activeTrack.title}</h2>

              <p className="detail-description">
                {activeTrack.description ||
                  "A new demo by vaix."}
              </p>

              <div className="tags">
                <span>{activeTrack.genre}</span>
                <span>{activeTrack.bpm} BPM</span>
                <span>{activeTrack.key}</span>
              </div>

              <div className="creator">
                <div className="creator-avatar">V</div>

                <div>
                  <strong>vaix</strong>
                  <span>Producer · Artist</span>
                </div>
              </div>

              <div className="detail-actions">
                <button
                  className="primary-button"
                  onClick={togglePlay}
                >
                  {playing ? (
                    <Pause size={17} />
                  ) : (
                    <Play size={17} />
                  )}

                  {playing ? "Pause" : "Play 30 sec"}
                </button>

                <button
                  className="secondary-button"
                  onClick={copyLink}
                >
                  <Link2 size={17} />
                  Copy Link
                </button>
              </div>
            </div>
          </div>

          <div className="share-panel">
            <div className="share-heading">
              <div>
                <p className="eyebrow">EXPORT</p>
                <h2>Share as Video</h2>
              </div>

              <Share2 size={20} />
            </div>

            <div className="video-preview">
              <div className="video-preview-inner">
                <span className="preview-brand">
                  demo.
                </span>

                <div className="preview-art">
                  <AudioLines size={52} />
                </div>

                <strong>{activeTrack.title}</strong>

                <small>by vaix</small>

                <div className="preview-time">
                  {formatTime(clipStart)} →{" "}
                  {formatTime(clipEnd)}
                </div>

                <div className="preview-badge">
                  1080 × 1920
                </div>
              </div>
            </div>

            <div className="clip-selector">
              <div className="clip-selector-heading">
                <div>
                  <strong>
                    Choose your 30-second section
                  </strong>

                  <span>
                    Drag the slider to any point in the
                    track.
                  </span>
                </div>

                <div className="clip-time">
                  {formatTime(clipStart)} →{" "}
                  {formatTime(clipStart + CLIP_LENGTH)}
                </div>
              </div>

              <div className="timeline">
                <div className="timeline-bars">
                  {timelineBars.map((height, index) => (
                    <span
                      key={index}
                      style={{
                        height: `${height}%`,
                      }}
                    />
                  ))}
                </div>

                {audioDuration >= CLIP_LENGTH && (
                  <div
                    className="timeline-selection"
                    style={{
                      left: `${selectionLeft}%`,
                      width: `${selectionWidth}%`,
                    }}
                  />
                )}
              </div>

              <input
                className="clip-slider"
                type="range"
                min="0"
                max={maxClipStart}
                step="0.1"
                value={Math.min(clipStart, maxClipStart)}
                disabled={audioDuration < CLIP_LENGTH}
                onChange={(event) =>
                  changeClipStart(
                    Number(event.target.value)
                  )
                }
              />

              <div className="timeline-labels">
                <span>0:00</span>
                <span>
                  {formatTime(audioDuration)}
                </span>
              </div>

              {audioDuration > 0 &&
                audioDuration < CLIP_LENGTH && (
                  <p className="clip-warning">
                    This track is shorter than 30 seconds.
                  </p>
                )}

              {audioDuration >= CLIP_LENGTH && (
                <p className="clip-selected">
                  Selected: {formatTime(clipStart)} –{" "}
                  {formatTime(clipStart + CLIP_LENGTH)}
                </p>
              )}
            </div>

            <div className="resolution-row">
              <div>
                <span>Format</span>
                <strong>MP4 · H.264 + AAC</strong>
              </div>

              <div>
                <span>Resolution</span>
                <strong>1080 × 1920</strong>
              </div>

              <div>
                <span>Length</span>
                <strong>Exactly 30 sec</strong>
              </div>
            </div>

            <button
              className="generate-button"
              onClick={generateVideo}
              disabled={
                videoBusy ||
                !activeTrack.audio ||
                audioDuration < CLIP_LENGTH
              }
            >
              {videoBusy ? (
                <>
                  <span className="spinner" />
                  Generating {Math.round(videoProgress)}%
                </>
              ) : (
                <>
                  <Download size={18} />
                  Generate 30s MP4
                </>
              )}
            </button>

            {videoReady && !videoBusy && (
              <div className="export-success">
                <Check size={16} />
                MP4 ready · 1080 × 1920 · 30 seconds
              </div>
            )}

            <p className="fine-print">
              The selected section is locked to exactly
              30 seconds. Move the slider to choose any
              part of your song.
            </p>
          </div>
        </section>
      )}

      <section className="about-section" id="about">
        <div>
          <p className="eyebrow">ABOUT</p>
          <h2>My edits. My sound.</h2>
        </div>

        <p>
          demo. is a simple workspace for keeping music
          projects, tracks and shareable snippets together.
        </p>
      </section>

      <footer>
        <div className="wordmark">demo.</div>
        <span>Made with ♥ by vaix</span>
      </footer>

      {/* Hidden audio */}
      <audio
        ref={audioRef}
        onLoadedMetadata={handleMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setPlaying(false)}
      />

      {/* Hidden video canvas */}
      <canvas
        ref={canvasRef}
        width={1080}
        height={1920}
        className="hidden-canvas"
      />

      {/* Add Track Modal */}
      {uploadOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setUploadOpen(false)}
        >
          <div
            className="upload-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">NEW TRACK</p>
                <h2>Add a Track</h2>
              </div>

              <button
                className="icon-button"
                onClick={() => setUploadOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-project">
              <span>Project</span>
              <strong>
                {activeProject?.name ||
                  "No project selected"}
              </strong>
            </div>

            <label className="field">
              <span>Track title</span>
              <input
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                placeholder="e.g. Midnight Demo"
              />
            </label>

            <label className="field">
              <span>Description</span>
              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder="Tell people about this demo..."
                rows={3}
              />
            </label>

            <div className="field-row">
              <label className="field">
                <span>Genre</span>
                <select
                  value={genre}
                  onChange={(event) =>
                    setGenre(event.target.value)
                  }
                >
                  <option>Hip Hop</option>
                  <option>Drill</option>
                  <option>Lo-fi</option>
                  <option>Indie</option>
                  <option>R&B</option>
                  <option>Electronic</option>
                  <option>Other</option>
                </select>
              </label>

              <label className="field">
                <span>BPM</span>
                <input
                  value={bpm}
                  onChange={(event) =>
                    setBpm(event.target.value)
                  }
                  placeholder="140"
                />
              </label>

              <label className="field">
                <span>Key</span>
                <input
                  value={key}
                  onChange={(event) =>
                    setKey(event.target.value)
                  }
                  placeholder="C#m"
                />
              </label>
            </div>

            <div className="upload-drop-row">
              <label className="upload-box">
                <Upload size={22} />
                <strong>
                  {pendingAudioUrl
                    ? "Audio selected"
                    : "Choose audio"}
                </strong>

                <small>
                  {pendingAudioUrl
                    ? `${formatTime(
                        pendingAudioDuration
                      )} · ready`
                    : "MP3, WAV, M4A"}
                </small>

                <input
                  type="file"
                  accept="audio/*"
                  onChange={onAudioUpload}
                />
              </label>

              <label className="upload-box">
                <Upload size={22} />
                <strong>
                  {pendingCoverUrl
                    ? "Cover selected"
                    : "Choose cover"}
                </strong>

                <small>
                  JPG, PNG, WEBP
                </small>

                <input
                  type="file"
                  accept="image/*"
                  onChange={onCoverUpload}
                />
              </label>
            </div>

            <p className="modal-hint">
              Tracks shorter than 30 seconds cannot be
              exported as a 30-second video.
            </p>

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() =>
                  setUploadOpen(false)
                }
              >
                Cancel
              </button>

              <button
                className="primary-button"
                onClick={addTrack}
              >
                <Plus size={18} />
                Add Track
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {projectOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setProjectOpen(false)}
        >
          <div
            className="upload-modal project-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">PROJECT FOLDER</p>
                <h2>New Project</h2>
              </div>

              <button
                className="icon-button"
                onClick={() =>
                  setProjectOpen(false)
                }
              >
                <X size={20} />
              </button>
            </div>

            <label className="field">
              <span>Project name</span>
              <input
                autoFocus
                value={projectName}
                onChange={(event) =>
                  setProjectName(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    createProject();
                  }
                }}
                placeholder="e.g. Album Ideas"
              />
            </label>

            <p className="modal-hint">
              Use projects to keep different songs,
              albums or ideas organized.
            </p>

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() =>
                  setProjectOpen(false)
                }
              >
                Cancel
              </button>

              <button
                className="primary-button"
                onClick={createProject}
              >
                <Plus size={18} />
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}