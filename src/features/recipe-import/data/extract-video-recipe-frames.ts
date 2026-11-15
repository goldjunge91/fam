import type { ImageManipulatorContext, SaveFormat } from 'expo-image-manipulator';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { VideoPlayer, VideoThumbnail } from 'expo-video';

export type RecipeVideoFrame = {
  uri: string;
  name: string;
  mimeType: 'image/jpeg';
};

const FRAME_FRACTIONS = [0.06, 0.24, 0.44, 0.64, 0.84] as const;
const VIDEO_LOAD_TIMEOUT_MS = 15_000;

type FrameManipulator = Pick<ImageManipulatorContext, 'resize' | 'renderAsync'>;

export type VideoFrameDependencies = {
  createPlayer: (source: { uri: string }) => VideoPlayer;
  manipulate: (thumbnail: VideoThumbnail) => FrameManipulator;
  jpegFormat: SaveFormat;
};

type VideoFrameDependencyLoader = () => Promise<VideoFrameDependencies>;

async function loadVideoFrameDependencies(): Promise<VideoFrameDependencies> {
  if (!requireOptionalNativeModule('ExpoVideo')) {
    throw new Error(
      'Die Videoverarbeitung ist in dieser lokalen App-Version noch nicht verfügbar. Der Development Build muss neu erstellt werden.',
    );
  }
  const [{ createVideoPlayer }, { ImageManipulator, SaveFormat }] = await Promise.all([
    import('expo-video'),
    import('expo-image-manipulator'),
  ]);
  return {
    createPlayer: createVideoPlayer,
    manipulate: (thumbnail) => ImageManipulator.manipulate(thumbnail),
    jpegFormat: SaveFormat.JPEG,
  };
}

function frameTimes(durationSeconds: number): number[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];
  const lastFrameTime = durationSeconds * 0.95;
  return [
    ...new Set(
      FRAME_FRACTIONS.map((fraction) => Math.min(durationSeconds * fraction, lastFrameTime)),
    ),
  ];
}

function waitUntilReady(player: VideoPlayer): Promise<void> {
  if (player.status === 'readyToPlay') return Promise.resolve();
  if (player.status === 'error') {
    return Promise.reject(
      new Error('Das Video konnte nicht gelesen werden. Wähle bitte ein anderes Video aus.'),
    );
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let subscription: ReturnType<VideoPlayer['addListener']> | undefined;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      subscription?.remove();
      if (error) reject(error);
      else resolve();
    };

    timeout = setTimeout(
      () =>
        finish(
          new Error('Das Video konnte nicht gelesen werden. Wähle bitte ein anderes Video aus.'),
        ),
      VIDEO_LOAD_TIMEOUT_MS,
    );
    subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') finish();
      else if (status === 'error') {
        finish(
          new Error('Das Video konnte nicht gelesen werden. Wähle bitte ein anderes Video aus.'),
        );
      }
    });
    // Ein lokales Video kann während des Listener-Setups fertig laden.
    if (player.status === 'readyToPlay') finish();
    else if (player.status === 'error') {
      finish(
        new Error('Das Video konnte nicht gelesen werden. Wähle bitte ein anderes Video aus.'),
      );
    }
  });
}

/** Extracts a few evenly spaced stills from a downloaded reel for the recipe vision import. */
export async function extractVideoRecipeFrames(
  videoUri: string,
  dependencies?: VideoFrameDependencies,
  loadDependencies: VideoFrameDependencyLoader = loadVideoFrameDependencies,
): Promise<RecipeVideoFrame[]> {
  // Keep native video code lazy so existing development builds can still open
  // the importer before expo-video has been added to their next local build.
  const { createPlayer, manipulate, jpegFormat } = dependencies ?? (await loadDependencies());
  const player = createPlayer({ uri: videoUri });
  player.muted = true;

  try {
    await waitUntilReady(player);
    const times = frameTimes(player.duration);
    if (times.length === 0) {
      throw new Error('Das Video konnte nicht gelesen werden. Wähle bitte ein anderes Video aus.');
    }

    const thumbnails = await player.generateThumbnailsAsync(times, {
      maxWidth: 1280,
      maxHeight: 1280,
    });
    if (thumbnails.length === 0) {
      throw new Error('Aus dem Video konnten keine Bilder gelesen werden.');
    }

    return await Promise.all(
      thumbnails.slice(0, 5).map(async (thumbnail, index) => {
        const resized = await manipulate(thumbnail).resize({ width: 1280 }).renderAsync();
        const image = await resized.saveAsync({ format: jpegFormat, compress: 0.82 });
        return {
          uri: image.uri,
          name: `Videoausschnitt ${String(index + 1)}.jpg`,
          mimeType: 'image/jpeg' as const,
        };
      }),
    );
  } finally {
    player.release();
  }
}
