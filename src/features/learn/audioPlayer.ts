export interface AudioLike {
  play: () => Promise<void> | void;
  pause: () => void;
}

export interface AudioPlayer {
  /** 翻面播放：先停掉上一张的音频，只有带 url 才开播 */
  flip: (url: string | null | undefined) => boolean;
  /** 点词条重播：每次都重新起一个实例，保证从头响一遍 */
  replay: (url: string | null | undefined) => boolean;
  stop: () => void;
  isPlaying: () => boolean;
}

// 音频语义单独抽出来，AC-4（翻面播一次 / 点词条重播 / 切卡停止）才能脱离浏览器自测
export function createAudioPlayer(create: (url: string) => AudioLike): AudioPlayer {
  let current: AudioLike | null = null;
  let playing = false;

  const stop = () => {
    if (current) current.pause();
    current = null;
    playing = false;
  };

  const start = (url: string) => {
    stop();
    const audio = create(url);
    current = audio;
    playing = true;
    audio.play();
    return true;
  };

  return {
    flip(url) {
      if (!url) {
        stop();
        return false;
      }
      return start(url);
    },
    replay(url) {
      if (!url) {
        stop();
        return false;
      }
      return start(url);
    },
    stop,
    isPlaying: () => playing,
  };
}
