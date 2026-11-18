const korean = {
  login: '로그인', googleLogin: 'Google 로그인 시작', localLogin: '테스트 계정으로 로그인', logout: '로그아웃',
  loading: '처리 중입니다.', retry: '다시 시도', noHousehold: '참여 중인 가구가 없습니다.',
  reminders: '리마인더', add: '리마인더 추가', empty: '리마인더가 없습니다.', more: '더 보기',
  title: '제목', description: '설명', scheduledAt: '예약 시각', save: '저장', cancel: '취소',
  AUTH_PROVIDER_UNAVAILABLE: '인증 서비스에 연결할 수 없습니다. 잠시 후 다시 시도하세요.',
  UNAUTHENTICATED: '로그인 정보를 확인할 수 없습니다. 다시 로그인하세요.',
  HOUSEHOLD_ACCESS_DENIED: '가구에 접근할 수 없습니다.',
  RATE_LIMITED: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.',
  TITLE_REQUIRED: '제목을 입력하세요.', TIME_REQUIRED: '유효한 예약 시각을 입력하세요.',
  INVALID_FIELD: '입력 내용을 확인하세요.', UNAVAILABLE: '요청을 처리하지 못했습니다. 다시 시도하세요.',
};

const english: Record<keyof typeof korean, string> = {
  login: 'Sign in', googleLogin: 'Start Google sign-in', localLogin: 'Sign in with test account', logout: 'Sign out',
  loading: 'Working…', retry: 'Try again', noHousehold: 'You do not belong to a household.',
  reminders: 'Reminders', add: 'Add reminder', empty: 'No reminders yet.', more: 'Show more',
  title: 'Title', description: 'Description', scheduledAt: 'Scheduled time', save: 'Save', cancel: 'Cancel',
  AUTH_PROVIDER_UNAVAILABLE: 'The sign-in service is unavailable. Try again in a moment.',
  UNAUTHENTICATED: 'Your sign-in could not be verified. Please sign in again.',
  HOUSEHOLD_ACCESS_DENIED: 'This household is unavailable.',
  RATE_LIMITED: 'There are too many requests. Try again shortly.',
  TITLE_REQUIRED: 'Enter a title.', TIME_REQUIRED: 'Enter a valid scheduled time.',
  INVALID_FIELD: 'Check the information you entered.', UNAVAILABLE: 'The request could not be completed. Try again.',
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
