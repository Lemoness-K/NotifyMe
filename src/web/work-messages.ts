import { errorText } from './messages.js';

const ko = {
  mine: '내 할 일', requested: '요청한 일', household: '가구 전체', history: '이력', archive: '보관함',
  edit: '리마인더 수정', archiveAction: '보관', restore: '복원', delete: '영구 삭제',
  confirm: '영구 삭제 확인', deleteHint: '앱에서 이 리마인더를 복구할 수 없습니다.',
  verification: '완료 검증', pending: '검증 대기', options: '배정, 조건 및 반복', requester: '요청자', assignees: '담당자',
  verifier: '검증자', trigger: '조건', TIME: '시간', LOCATION: '장소', placeName: '장소 이름', latitude: '위도',
  longitude: '경도', radius: '반경(m)', adjustRadius: '반경 조정', event: '이벤트', duration: '지속 시간(분)',
  ENTER: '진입', EXIT: '이탈', DWELL: '머무름', AFTER_EXIT: '이탈 후', recurrence: '반복', once: '한 번',
  DAILY: '매일', WEEKLY: '매주', MONTHLY: '매월', interval: '간격', weeklyDays: '요일',
  monthDays: '매월 날짜', lastDay: '말일', endOn: '종료일', scope: '편집 범위',
  THIS_OCCURRENCE: '이번 회차만', THIS_AND_FUTURE: '이번부터 이후', ENTIRE_SERIES: '전체 반복',
  COMPLETE: '완료', UNDO_COMPLETE: '완료 취소', SKIP: '건너뛰기', APPROVE: '완료 승인', REJECT: '완료 거절',
  WITHDRAW_VERIFICATION: '요청 철회', PENDING: '미완료', VERIFICATION_PENDING: '검증 대기', COMPLETED: '완료됨',
  CANCELLED: '취소됨', MISSED: '놓침', SKIPPED: '건너뜀', ARCHIVED: '보관됨', ACTIVE: '활성',
  CREATED: '생성됨', EDITED: '수정됨', ARCHIVE: '보관됨', RESTORE: '복원됨', VERIFIER_REVOKED: '검증자 소속 종료',
  ACCESS_REVOKED: '구성원 소속 종료', RADIUS_ADJUSTED: '반경 조정', RECURRENCE_ADVANCED: '다음 회차 갱신',
  OVERDUE: '기한 초과', TODAY: '오늘', UPCOMING: '예정', VERIFICATION: '검증 대기',
  noHistory: '표시할 이력이 없습니다.', noOccurrence: '현재 회차가 없습니다.', actions: '회차 동작',
  lifecycle: '리마인더 수명주기', occurrenceFlow: '회차 상태 흐름', unassigned: '담당자 없음', paused: '반복 일시 중지',
  capacity: '대상 기기의 위치 감지 용량이 부족합니다.', targetInstallation: '대상 기기', remainingCapacity: '남은 용량',
  allOccurrences: '전체 회차', select: '선택', draft: '입력한 내용', back: '할 일로 돌아가기',
};
const en: Record<keyof typeof ko, string> = {
  mine: 'My tasks', requested: 'Requested by me', household: 'Household', history: 'History', archive: 'Archive',
  edit: 'Edit reminder', archiveAction: 'Archive', restore: 'Restore', delete: 'Delete permanently',
  confirm: 'Confirm permanent deletion', deleteHint: 'This reminder cannot be recovered in the app.',
  verification: 'Completion verification', pending: 'Pending verification', options: 'Assignment, trigger and repeat',
  requester: 'Requester', assignees: 'Assignees', verifier: 'Verifier', trigger: 'Trigger', TIME: 'Time', LOCATION: 'Place',
  placeName: 'Place name', latitude: 'Latitude', longitude: 'Longitude', radius: 'Radius (m)', adjustRadius: 'Adjust radius', event: 'Event',
  duration: 'Duration (minutes)', ENTER: 'Enter', EXIT: 'Exit', DWELL: 'Stay', AFTER_EXIT: 'After leaving',
  recurrence: 'Repeat', once: 'Once', DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', interval: 'Interval',
  weeklyDays: 'Days of the week', monthDays: 'Day of the month', lastDay: 'Last day', endOn: 'End date',
  scope: 'Edit scope', THIS_OCCURRENCE: 'This occurrence', THIS_AND_FUTURE: 'This and future occurrences',
  ENTIRE_SERIES: 'Entire series', COMPLETE: 'Complete', UNDO_COMPLETE: 'Undo completion', SKIP: 'Skip',
  APPROVE: 'Approve completion', REJECT: 'Reject completion', WITHDRAW_VERIFICATION: 'Withdraw request',
  PENDING: 'Pending', VERIFICATION_PENDING: 'Pending verification', COMPLETED: 'Completed', CANCELLED: 'Canceled', MISSED: 'Missed',
  SKIPPED: 'Skipped', ARCHIVED: 'Archived', ACTIVE: 'Active', CREATED: 'Created', EDITED: 'Edited', ARCHIVE: 'Archived',
  RESTORE: 'Restored', VERIFIER_REVOKED: 'Verifier membership ended', ACCESS_REVOKED: 'Member removed',
  RADIUS_ADJUSTED: 'Radius adjusted', RECURRENCE_ADVANCED: 'Next occurrence updated',
  OVERDUE: 'Overdue', TODAY: 'Today', UPCOMING: 'Upcoming', VERIFICATION: 'Pending verification',
  noHistory: 'No history yet.', noOccurrence: 'No current occurrence.', actions: 'Occurrence actions',
  lifecycle: 'Reminder lifecycle', occurrenceFlow: 'Occurrence states', unassigned: 'Unassigned', paused: 'Repeat paused',
  capacity: 'A target device has insufficient geofence capacity.', targetInstallation: 'Target device', remainingCapacity: 'Remaining capacity',
  allOccurrences: 'All occurrences', select: 'Select', draft: 'Entered values', back: 'Back to tasks',
};

export const workWords = { 'ko-KR': ko, 'en-US': en };
export function workLabel(locale: keyof typeof workWords, key: string) {
  return workWords[locale][key as keyof typeof ko] ?? key;
}

export function workErrorText(locale: keyof typeof workWords, code: string, details?: Record<string, unknown>) {
  if (code !== 'GEOFENCE_CAPACITY_EXCEEDED') return errorText(locale, code);
  const text = workWords[locale];
  const installation = details?.installationId;
  const rawRemaining = details?.remainingCapacity;
  const remaining = typeof rawRemaining === 'number' || typeof rawRemaining === 'string' ? Number(rawRemaining) : NaN;
  return [text.capacity, typeof installation === 'string' ? text.targetInstallation + ' ' + installation : '',
    Number.isSafeInteger(remaining) && remaining >= 0 ?
      text.remainingCapacity + ' ' + new Intl.NumberFormat(locale).format(remaining) : ''].filter(Boolean).join(' · ');
}
