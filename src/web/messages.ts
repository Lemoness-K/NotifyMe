const korean = {
  login: '로그인', googleLogin: 'Google 로그인 시작', localLogin: '테스트 계정으로 로그인', logout: '로그아웃',
  loading: '처리 중입니다.', retry: '다시 시도', noHousehold: '참여 중인 가구가 없습니다.',
  setupHeading: '최초 관리자 설정', setupAccount: '로그인한 Google 계정', setupStart: '설정 시작',
  setupExplanation: '이 계정이 Notify Me의 최초 관리자가 됩니다. 가구를 만들고 구성원을 초대할 수 있습니다.',
  setupReauthenticate: '설정을 계속하려면 같은 Google 계정으로 다시 로그인하세요.',
  SETUP_EXPIRED: '설정 가능 시간이 지났습니다. 다시 로그인하세요.',
  SETUP_RESERVED: '다른 설정 시도가 진행 중입니다. 잠시 후 다시 로그인하세요.',
  SETUP_UNAVAILABLE: '현재 초기 설정을 사용할 수 없습니다. 잠시 후 다시 시도하거나 운영자에게 문의하세요.',
  SETUP_RESULT_UNKNOWN: '설정 결과를 확인하지 못했습니다. 다시 시도하거나 같은 Google 계정으로 로그인하세요.',
  SETUP_CANCEL_UNKNOWN: '취소를 확인하지 못했습니다. 다시 시도하세요. 취소가 전달되지 않으면 예약은 만료될 때까지 유지됩니다.',
  reminders: '리마인더', add: '리마인더 추가', empty: '리마인더가 없습니다.', more: '더 보기',
  title: '제목', description: '설명', scheduledAt: '예약 시각', save: '저장', cancel: '취소',
  AUTH_PROVIDER_UNAVAILABLE: '인증 서비스에 연결할 수 없습니다. 잠시 후 다시 시도하세요.',
  UNAUTHENTICATED: '로그인 정보를 확인할 수 없습니다. 다시 로그인하세요.',
  HOUSEHOLD_ACCESS_DENIED: '가구에 접근할 수 없습니다.',
  RATE_LIMITED: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.',
  TITLE_REQUIRED: '제목을 입력하세요.', TIME_REQUIRED: '유효한 예약 시각을 입력하세요.',
  INVALID_FIELD: '입력 내용을 확인하세요.', UNAVAILABLE: '요청을 처리하지 못했습니다. 다시 시도하세요.',
  navigation: '주요 메뉴', settings: '설정', personal: '개인 설정', household: '가구 설정',
  installation: '이 기기', installationUnavailable: 'Android 앱에서 이 기기의 알림·위치 권한과 알림 채널을 관리할 수 있습니다.',
  locale: '표시 언어', timeZone: '표시 시간대', defaultTimeZone: '새 일정의 기본 시간대',
  radiusMin: '최소 반경(m)', radiusDefault: '기본 반경(m)', radiusMax: '최대 반경(m)', maxDuration: '장소 조건 최대 시간(분)',
  calendar: '주간 반복 기준', monday: '월요일 시작', sunday: '일요일 시작', isoWeek: 'ISO 8601',
  radiusNotice: '최소·최대 반경을 바꾸면 기존 장소 조건도 새 범위에 맞게 조정됩니다.',
  members: '구성원 관리', invitations: '초대 관리', email: '초대할 Google 이메일', issue: '초대 발급',
  inviteLink: '공유할 초대 링크', copy: '링크 복사', copied: '링크를 복사했습니다.', revoke: '초대 취소',
  inviteJoin: '가구 초대 수락', googleJoin: 'Google 계정으로 초대 수락', localJoin: '테스트 계정으로 초대 수락',
  active: '활성', consumed: '수락됨', revoked: '취소됨', expired: '만료됨', expires: '만료', emptyInvites: '발급된 초대가 없습니다.',
  admin: 'Admin', member: 'Member', remove: '제거', roleTo: '역할 변경', confirmRemove: '제거 확인',
  successor: '후임 관리자', selectMember: '구성원 선택', saved: '저장했습니다.', refresh: '새로고침',
  confirmRemoveHint: '가구에 접근할 수 없게 되며 활성 배정이 종료됩니다.',
  INVITATION_INVALID: '초대를 사용할 수 없습니다. 올바른 Google 계정을 확인하거나 새 초대를 요청하세요.',
  INVITATION_ALREADY_ISSUED: '이미 초대를 발급했습니다. 기존 초대를 취소한 뒤 새 링크를 발급하세요.',
  INVITATION_INACTIVE: '이미 종료된 초대입니다.',
  INVITATION_NOT_FOUND: '초대를 찾을 수 없습니다.',
  LAST_ADMIN: '마지막 관리자를 변경하려면 후임 관리자를 선택하세요.',
  INVALID_SUCCESSOR: '후임 관리자는 같은 가구의 활성 구성원이어야 합니다.',
  STALE_REVISION: '다른 변경이 먼저 저장됐습니다. 새로고침한 뒤 다시 시도하세요.',
  ADMIN_REQUIRED: '이 작업에는 가구 관리자 권한이 필요합니다.',
  IDEMPOTENCY_CONFLICT: '이미 다른 내용에 사용한 요청입니다. 다시 확인하고 저장하세요.',
};

const english: Record<keyof typeof korean, string> = {
  login: 'Sign in', googleLogin: 'Start Google sign-in', localLogin: 'Sign in with test account', logout: 'Sign out',
  loading: 'Working…', retry: 'Try again', noHousehold: 'You do not belong to a household.',
  setupHeading: 'Set up the first administrator', setupAccount: 'Signed-in Google account', setupStart: 'Start setup',
  setupExplanation: 'This account will be the first Notify Me administrator. You can create the household and invite members.',
  setupReauthenticate: 'Sign in again with the same Google account to continue setup.',
  SETUP_EXPIRED: 'Your setup reservation expired. Sign in again.',
  SETUP_RESERVED: 'Another setup attempt is in progress. Try signing in again later.',
  SETUP_UNAVAILABLE: 'Initial setup is unavailable. Try again later or contact the operator.',
  SETUP_RESULT_UNKNOWN: 'The setup result could not be confirmed. Try again or sign in with the same Google account.',
  SETUP_CANCEL_UNKNOWN: 'Cancellation could not be confirmed. Try again. A reservation stays active until it expires if cancellation does not go through.',
  reminders: 'Reminders', add: 'Add reminder', empty: 'No reminders yet.', more: 'Show more',
  title: 'Title', description: 'Description', scheduledAt: 'Scheduled time', save: 'Save', cancel: 'Cancel',
  AUTH_PROVIDER_UNAVAILABLE: 'The sign-in service is unavailable. Try again in a moment.',
  UNAUTHENTICATED: 'Your sign-in could not be verified. Please sign in again.',
  HOUSEHOLD_ACCESS_DENIED: 'This household is unavailable.',
  RATE_LIMITED: 'There are too many requests. Try again shortly.',
  TITLE_REQUIRED: 'Enter a title.', TIME_REQUIRED: 'Enter a valid scheduled time.',
  INVALID_FIELD: 'Check the information you entered.', UNAVAILABLE: 'The request could not be completed. Try again.',
  navigation: 'Main menu', settings: 'Settings', personal: 'Personal settings', household: 'Household settings',
  installation: 'This device', installationUnavailable: 'Manage notification and location permissions and channels in the Android app.',
  locale: 'Display language', timeZone: 'Display time zone', defaultTimeZone: 'Default time zone for new schedules',
  radiusMin: 'Minimum radius (m)', radiusDefault: 'Default radius (m)', radiusMax: 'Maximum radius (m)', maxDuration: 'Maximum location duration (minutes)',
  calendar: 'Weekly calendar', monday: 'Monday start', sunday: 'Sunday start', isoWeek: 'ISO 8601',
  radiusNotice: 'Changing the minimum or maximum adjusts existing location conditions to the new limits.',
  members: 'Manage members', invitations: 'Manage invitations', email: 'Google email to invite', issue: 'Issue invitation',
  inviteLink: 'Invitation link to share', copy: 'Copy link', copied: 'Link copied.', revoke: 'Revoke invitation',
  inviteJoin: 'Accept household invitation', googleJoin: 'Accept with Google', localJoin: 'Accept with test account',
  active: 'Active', consumed: 'Accepted', revoked: 'Revoked', expired: 'Expired', expires: 'Expires', emptyInvites: 'No invitations have been issued.',
  admin: 'Admin', member: 'Member', remove: 'Remove', roleTo: 'Change role', confirmRemove: 'Confirm removal',
  successor: 'Successor Admin', selectMember: 'Select a member', saved: 'Saved.', refresh: 'Refresh',
  confirmRemoveHint: 'The member will lose household access and their active assignments will end.',
  INVITATION_INVALID: 'This invitation could not be used. Check the Google account or request a new invitation.',
  INVITATION_ALREADY_ISSUED: 'The invitation was already issued. Revoke it before issuing another link.',
  INVITATION_INACTIVE: 'This invitation is no longer active.',
  INVITATION_NOT_FOUND: 'The invitation could not be found.',
  LAST_ADMIN: 'Select a successor before changing the last Admin.',
  INVALID_SUCCESSOR: 'The successor must be an active member of this household.',
  STALE_REVISION: 'Someone saved a newer version. Refresh and try again.',
  ADMIN_REQUIRED: 'This action requires household Admin access.',
  IDEMPOTENCY_CONFLICT: 'This request key was used with different information. Check your changes and try again.',
};

export const words = { 'ko-KR': korean, 'en-US': english };
export function localeFor(device: string): keyof typeof words {
  return device.toLowerCase().split('-')[0] === 'en' ? 'en-US' : 'ko-KR';
}
export function errorText(locale: string, code: string) {
  const messages = words[localeFor(locale)];
  return Object.hasOwn(messages, code) ? messages[code as keyof typeof messages] : messages.UNAVAILABLE;
}

export function retryAfterText(locale: keyof typeof words, retryAt: number) {
  const time = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' })
    .format(Math.ceil(retryAt / 1000) * 1000);
  return locale === 'ko-KR' ? `${time} 이후에 다시 시도하세요.` : `Try again after ${time}.`;
}
