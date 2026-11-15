import type { ImageResult, SaveFormat } from 'expo-image-manipulator';
import type { VideoPlayer, VideoThumbnail } from 'expo-video';
import {
  extractVideoRecipeFrames,
  type VideoFrameDependencies,
} from './extract-video-recipe-frames';

const mockCreatePlayer = jest.fn();
const mockManipulate = jest.fn();
const mockRequireOptionalNativeModule = jest.fn();

jest.mock('expo-modules-core', () => ({
  ...jest.requireActual('expo-modules-core'),
  requireOptionalNativeModule: (...args: unknown[]) => mockRequireOptionalNativeModule(...args),
}));

const dependencies: VideoFrameDependencies = {
  createPlayer: ({ uri }) => mockCreatePlayer(uri) as VideoPlayer,
  manipulate: (thumbnail) => mockManipulate(thumbnail) as never,
  jpegFormat: 'jpeg' as SaveFormat,
};

function player(overrides: Partial<VideoPlayer> = {}): VideoPlayer {
  return {
    status: 'readyToPlay',
    duration: 10,
    generateThumbnailsAsync: jest.fn(async (times: number | number[]) =>
      (Array.isArray(times) ? times : [times]).map(
        (time) => ({ requestedTime: time }) as VideoThumbnail,
      ),
    ),
    addListener: jest.fn(() => ({ remove: jest.fn() })) as VideoPlayer['addListener'],
    release: jest.fn(),
    ...overrides,
  } as unknown as VideoPlayer;
}

function image(uri: string): ImageResult {
  return { uri, width: 1280, height: 720 };
}

describe('extractVideoRecipeFrames', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireOptionalNativeModule.mockImplementation(
      jest.requireActual('expo-modules-core').requireOptionalNativeModule,
    );
    mockCreatePlayer.mockReturnValue(player());
    mockManipulate.mockImplementation((thumbnail: { requestedTime: number }) => ({
      resize: jest.fn().mockReturnThis(),
      renderAsync: jest.fn().mockResolvedValue({
        saveAsync: jest
          .fn()
          .mockResolvedValue(image(`file://frame-${thumbnail.requestedTime}.jpg`)),
      }),
    }));
  });

  it('loads dependencies lazily when no dependencies are injected', async () => {
    const created = player();
    mockCreatePlayer.mockReturnValue(created);
    const loadDependencies = jest.fn(async () => dependencies);

    const frames = await extractVideoRecipeFrames(
      'file://native-reel.mp4',
      undefined,
      loadDependencies,
    );

    expect(loadDependencies).toHaveBeenCalledTimes(1);
    expect(mockCreatePlayer).toHaveBeenCalledWith('file://native-reel.mp4');
    expect(mockManipulate).toHaveBeenCalledTimes(5);
    expect(frames[0]?.uri).toBe('file://frame-0.6.jpg');
    expect(created.release).toHaveBeenCalledTimes(1);
  });

  it('reports a missing ExpoVideo native module before importing its native package', async () => {
    mockRequireOptionalNativeModule.mockReturnValueOnce(null);

    await expect(extractVideoRecipeFrames('file://reel.mp4')).rejects.toThrow(
      'Die Videoverarbeitung ist in dieser lokalen App-Version noch nicht verfügbar. Der Development Build muss neu erstellt werden.',
    );
    expect(mockRequireOptionalNativeModule).toHaveBeenCalledWith('ExpoVideo');
    expect(mockCreatePlayer).not.toHaveBeenCalled();
  });

  it('extracts at most five compressed JPEG frames at spaced times', async () => {
    const created = player();
    mockCreatePlayer.mockReturnValue(created);

    const frames = await extractVideoRecipeFrames('file://reel.mp4', dependencies);

    expect(created.generateThumbnailsAsync).toHaveBeenCalledWith([0.6, 2.4, 4.4, 6.4, 8.4], {
      maxWidth: 1280,
      maxHeight: 1280,
    });
    expect(frames).toEqual([
      { uri: 'file://frame-0.6.jpg', name: 'Videoausschnitt 1.jpg', mimeType: 'image/jpeg' },
      { uri: 'file://frame-2.4.jpg', name: 'Videoausschnitt 2.jpg', mimeType: 'image/jpeg' },
      { uri: 'file://frame-4.4.jpg', name: 'Videoausschnitt 3.jpg', mimeType: 'image/jpeg' },
      { uri: 'file://frame-6.4.jpg', name: 'Videoausschnitt 4.jpg', mimeType: 'image/jpeg' },
      { uri: 'file://frame-8.4.jpg', name: 'Videoausschnitt 5.jpg', mimeType: 'image/jpeg' },
    ]);
    expect(created.release).toHaveBeenCalledTimes(1);
  });

  it('waits for the native player to load the video before extracting frames', async () => {
    const readyPlayer = player({ status: 'loading' });
    (readyPlayer.addListener as jest.Mock).mockImplementation((_event, listener) => {
      queueMicrotask(() => listener({ status: 'readyToPlay' }));
      return { remove: jest.fn() };
    });
    mockCreatePlayer.mockReturnValue(readyPlayer);

    await expect(extractVideoRecipeFrames('file://reel.mp4', dependencies)).resolves.toHaveLength(
      5,
    );
    expect(readyPlayer.release).toHaveBeenCalledTimes(1);
  });

  it('returns a readable error and releases a player that cannot load the video', async () => {
    const failedPlayer = player({ status: 'error' });
    mockCreatePlayer.mockReturnValue(failedPlayer);

    await expect(extractVideoRecipeFrames('file://unreadable.mp4', dependencies)).rejects.toThrow(
      'Das Video konnte nicht gelesen werden. Wähle bitte ein anderes Video aus.',
    );
    expect(failedPlayer.release).toHaveBeenCalledTimes(1);
    expect(failedPlayer.generateThumbnailsAsync).not.toHaveBeenCalled();
  });

  it('rejects empty, unsupported, or too short video data without leaking the player', async () => {
    const noFrames = player({ generateThumbnailsAsync: jest.fn().mockResolvedValue([]) });
    mockCreatePlayer.mockReturnValue(noFrames);
    await expect(extractVideoRecipeFrames('file://no-frames.mp4', dependencies)).rejects.toThrow(
      'Aus dem Video konnten keine Bilder gelesen werden.',
    );
    expect(noFrames.release).toHaveBeenCalledTimes(1);

    const noDuration = player({ duration: Number.NaN });
    mockCreatePlayer.mockReturnValue(noDuration);
    await expect(extractVideoRecipeFrames('file://broken.mp4', dependencies)).rejects.toThrow(
      'Das Video konnte nicht gelesen werden. Wähle bitte ein anderes Video aus.',
    );
    expect(noDuration.release).toHaveBeenCalledTimes(1);
  });

  it('rejects a failed image conversion and still releases the video player', async () => {
    const activePlayer = player();
    mockCreatePlayer.mockReturnValue(activePlayer);
    mockManipulate.mockImplementation(() => ({
      resize: jest.fn().mockReturnThis(),
      renderAsync: jest.fn().mockRejectedValue(new Error('decode failed')),
    }));

    await expect(extractVideoRecipeFrames('file://reel.mp4', dependencies)).rejects.toThrow(
      'decode failed',
    );
    expect(activePlayer.release).toHaveBeenCalledTimes(1);
  });
});
