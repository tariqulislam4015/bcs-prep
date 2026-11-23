/* =========================================================================
   BCS Preparation & MCQ Platform — static configuration
   Subjects, preliminary-exam blueprint and per-BCS default exam settings.
   ========================================================================= */
(function () {
  'use strict';

  // The 10 subject areas of the BCS preliminary syllabus (200-mark pattern).
  // `marks` = number of questions in the 200-mark blueprint (35th BCS onward).
  const SUBJECTS = [
    { key: 'bangla',     en: 'Bangla Language and Literature',                    bn: 'বাংলা ভাষা ও সাহিত্য',                   short: 'Bangla',      marks: 35 },
    { key: 'english',    en: 'English Language and Literature',                   bn: 'ইংরেজি ভাষা ও সাহিত্য',                  short: 'English',     marks: 35 },
    { key: 'bdaffairs',  en: 'Bangladesh Affairs',                                bn: 'বাংলাদেশ বিষয়াবলি',                      short: 'Bangladesh',  marks: 30 },
    { key: 'intaffairs', en: 'International Affairs',                             bn: 'আন্তর্জাতিক বিষয়াবলি',                   short: 'International', marks: 20 },
    { key: 'science',    en: 'General Science',                                   bn: 'সাধারণ বিজ্ঞান',                          short: 'Science',     marks: 15 },
    { key: 'ict',        en: 'Computer and Information Technology',               bn: 'কম্পিউটার ও তথ্যপ্রযুক্তি',               short: 'Computer/ICT', marks: 15 },
    { key: 'math',       en: 'Mathematical Reasoning',                            bn: 'গাণিতিক যুক্তি',                          short: 'Mathematics', marks: 15 },
    { key: 'mental',     en: 'Mental Ability',                                    bn: 'মানসিক দক্ষতা',                           short: 'Mental Ability', marks: 15 },
    { key: 'geo',        en: 'Geography, Environment and Disaster Management',    bn: 'ভূগোল, পরিবেশ ও দুর্যোগ ব্যবস্থাপনা',      short: 'Geography',   marks: 10 },
    { key: 'ethics',     en: 'Ethics, Values and Good Governance',                bn: 'নৈতিকতা, মূল্যবোধ ও সুশাসন',              short: 'Ethics',      marks: 10 }
  ];

  const BCS_MIN = 10;
  const BCS_MAX = 50;

  // Default exam settings. These are DEFAULTS that you can override per BCS
  // from Settings. From the 35th BCS onward the preliminary test is 200 MCQ /
  // 200 marks / 2 hours with 0.50 negative marking. For earlier examinations
  // the app uses a 100-question / 60-minute default — check the circular for
  // the specific examination you are simulating and adjust it in Settings.
  function defaultExamConfig(bcs) {
    if (bcs >= 35) {
      return { questions: 200, durationMin: 120, correctMark: 1, negativeMark: 0.5, note: '200-mark preliminary pattern (35th BCS onward).' };
    }
    return { questions: 100, durationMin: 60, correctMark: 1, negativeMark: 0.5, note: 'Default for pre-35th BCS (100-mark pattern). Verify against the official circular and adjust in Settings if needed.' };
  }

  function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  const LEVELS = [
    { min: 80, label: 'Strong',  cls: 'lvl-strong' },
    { min: 65, label: 'Good',    cls: 'lvl-good' },
    { min: 50, label: 'Average', cls: 'lvl-average' },
    { min: 0,  label: 'Weak',    cls: 'lvl-weak' }
  ];
  const MIN_ATTEMPTS_FOR_LEVEL = 5; // below this, "Not enough data"

  window.BCS_CONFIG = {
    SUBJECTS, BCS_MIN, BCS_MAX, LEVELS, MIN_ATTEMPTS_FOR_LEVEL,
    defaultExamConfig, ordinal,
    subjectByKey: Object.fromEntries(SUBJECTS.map(s => [s.key, s])),
    APP_NAME: 'TIS Academy — BCS Preparation & MCQ Platform',
    STORAGE_KEY: 'bcsprep.v1'
  };
})();
