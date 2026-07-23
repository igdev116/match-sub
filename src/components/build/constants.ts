import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/vi'
import type { BuildConfig, MotionSequenceItem, PathInfo } from '../../../electron/types'

dayjs.extend(relativeTime)
dayjs.locale('vi')

export const RESOLUTIONS = ['1920x1080', '1280x720', '1080x1920', '3840x2160']

export const MOTION_EFFECTS_WITH_ZOOM_OUT: BuildConfig['motionEffect'][] = [
  'auto',
  'zoom-out',
  'zoom-out-top-left',
  'zoom-out-top-right',
  'alternate-corner-in-out',
]

const LEGACY_AUTOMATIC_MOTION_EFFECTS: BuildConfig['motionEffect'][] = [
  'zoom-right',
  'zoom-left',
  'zoom-center',
  'zoom-up',
  'zoom-down',
  'zoom-out',
]

const LEGACY_ALTERNATE_TOP_CORNER_EFFECTS: BuildConfig['motionEffect'][] = [
  'zoom-top-right',
  'zoom-top-left',
]

const LEGACY_ALTERNATE_TOP_CORNER_REVERSE_EFFECTS: BuildConfig['motionEffect'][] = [
  'zoom-top-left',
  'zoom-top-right',
]

const LEGACY_ALTERNATE_CORNER_IN_OUT_EFFECTS: BuildConfig['motionEffect'][] = [
  'zoom-top-left',
  'zoom-out-top-left',
  'zoom-top-right',
  'zoom-out-top-right',
]

export const MOTION_EFFECT_OPTIONS: { value: BuildConfig['motionEffect']; label: string }[] = [
  { value: 'zoom-top-left', label: 'Zoom vào góc trái trên' },
  { value: 'zoom-top-right', label: 'Zoom vào góc phải trên' },
  { value: 'zoom-out-top-left', label: 'Zoom từ trong ra — góc trái trên' },
  { value: 'zoom-out-top-right', label: 'Zoom từ trong ra — góc phải trên' },
  { value: 'zoom-right', label: 'Zoom vào bên phải' },
  { value: 'zoom-left', label: 'Zoom vào bên trái' },
  { value: 'zoom-center', label: 'Zoom vào chính giữa' },
  { value: 'zoom-up', label: 'Zoom lên phía trên' },
  { value: 'zoom-down', label: 'Zoom xuống phía dưới' },
  { value: 'zoom-out', label: 'Thu nhỏ dần từ giữa' },
  { value: 'none', label: 'Đứng yên' },
]

export type SourceKey =
  | 'imagesDirectory'
  | 'sceneListPath'
  | 'srtPath'
  | 'timelinePath'
  | 'outputPath'

export const emptyPathInfo: PathInfo = {
  path: '',
  exists: false,
  kind: 'missing',
  createdAt: null,
  modifiedAt: null,
}

export function hasZoomOutMotion(effect: BuildConfig['motionEffect']): boolean {
  return MOTION_EFFECTS_WITH_ZOOM_OUT.includes(effect)
}

export function hasZoomInMotion(effect: BuildConfig['motionEffect']): boolean {
  return effect !== 'none' && !hasZoomOutMotion(effect)
}

export function newMotionSequenceItem(effect: BuildConfig['motionEffect']): MotionSequenceItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    effect,
  }
}

export function expandLegacyMotionSequenceItem(item: MotionSequenceItem): MotionSequenceItem[] {
  const effectGroups: Partial<Record<BuildConfig['motionEffect'], BuildConfig['motionEffect'][]>> = {
    auto: LEGACY_AUTOMATIC_MOTION_EFFECTS,
    'alternate-top-corners': LEGACY_ALTERNATE_TOP_CORNER_EFFECTS,
    'alternate-top-corners-reverse': LEGACY_ALTERNATE_TOP_CORNER_REVERSE_EFFECTS,
    'alternate-corner-in-out': LEGACY_ALTERNATE_CORNER_IN_OUT_EFFECTS,
  }
  const effects = effectGroups[item.effect]
  if (!effects) return [item]
  return effects.map((effect, index) => ({
    id: `${item.id}-${index}`,
    effect,
  }))
}

export function formatPathMeta(info?: PathInfo): string {
  if (!info?.exists) return ''
  const timestamp = info.modifiedAt || info.createdAt
  if (!timestamp) return ''
  return `Cập nhật: ${dayjs(timestamp).format('DD/MM/YYYY HH:mm')} (${dayjs(timestamp).fromNow()})`
}
