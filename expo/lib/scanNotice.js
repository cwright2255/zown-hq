// The notice shown once, before a person's first body scan (components/ScanNotice.jsx, app/body-scan/capture.jsx). It says what a scan
// keeps and where its numbers go, in the same terms as the privacy policy (app/profile/privacy-policy.jsx).
//
// That the person has seen it is saved on their profile as bodyScanNotice: { version, at }, where `at` is the time they agreed. The
// version is what they agreed to. Raise SCAN_NOTICE_VERSION when the notice changes in a way that matters (a scan starts keeping
// something new, or its numbers go somewhere new) and everyone is shown the new notice before their next scan.

export const SCAN_NOTICE_VERSION = 1;

/** True when this person has already agreed to the current notice. */
export function hasAcceptedScanNotice(user) {
  const version = Number(user?.bodyScanNotice?.version);
  return Number.isFinite(version) && version >= SCAN_NOTICE_VERSION;
}

/** What to save on the profile when the person agrees. */
export function acceptedScanNotice(now = new Date()) {
  return { version: SCAN_NOTICE_VERSION, at: now.toISOString() };
}

// The points the notice makes, one per row. Each is true of the app as it is now (nothing here is uploaded, and the numbers go to the
// AI insight); change the app, the privacy policy and this list together.
export const SCAN_NOTICE_POINTS = [
  {
    icon: 'phone-portrait-outline',
    title: 'Your camera images stay on your phone',
    body: 'They are read on your device to find your body\'s outline. They are not saved and not uploaded.',
  },
  {
    icon: 'analytics-outline',
    title: 'Only the numbers are saved',
    body: 'Your measurements and body-fat estimate, so you can see your progress over time.',
  },
  {
    icon: 'sparkles-outline',
    title: 'Those numbers are sent to OpenAI',
    body: 'To write your AI insight. We do not sell your data or use it for ads.',
  },
  {
    icon: 'trash-outline',
    title: 'You can erase it all',
    body: 'Deleting your account in Settings, under Danger Zone, erases your scan records.',
  },
];
