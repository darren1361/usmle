/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { USMLERow } from './types';

export const SYSTEM_OPTIONS = [
  "Poisoning & Environmental Exposure",
  "Biostatistics & Epidemiology",
  "Male Reproductive System",
  "Miscellaneous",
  "Nervous System",
  "Rheumatology/Orthopedics & Sports",
  "Female Reproductive System & Breast",
  "Ear, Nose & Throat",
  "Endocrine, Diabetes & Metabolism",
  "Pulmonary & Critical Care",
  "Dermatology",
  "Social Sciences",
  "Infectious Diseases",
  "Cardiovascular System",
  "Renal, Urinary Systems & Electrolytes",
  "Allergy & Immunology",
  "Pregnancy, Childbirth & Puerperium",
  "Ophthalmology",
  "Gastrointestinal & Nutrition",
  "Hematology & Oncology",
  "Psychiatric/Behavioral & Substance Use Disorder",
  "General Principles"
].sort(); // Sorted alphabetically for a neat select dropdown list

export const ATTEMPT_OPTIONS = ["Correct", "Incorrect", "Omitted"];

// The fixed, stable and unalterable database of Questions matching the user's specific performance screenshot.
export const DEFAULT_FIXED_QUESTIONS: USMLERow[] = [
  {
    id: 1,
    qid: "2371",
    topic: "Aortic aneurysm",
    system: "Cardiovascular System",
    attempt1: "Incorrect",
    attempt2: "",
    studyGuide: "Abdominal aortic aneurysm (AAA) is characterized by a localized dilation of the abdominal aorta >= 3.0 cm. Screening is recommended for men aged 65-75 with any smoking history via a one-time ultrasound. Surgical repair is indicated if diameter >= 5.5 cm or expanding rapidly (>0.5 cm in 6 months).",
    date: "2026-06-02"
  },
  {
    id: 2,
    qid: "4676",
    topic: "Atrial fibrillation",
    system: "Cardiovascular System",
    attempt1: "Incorrect",
    attempt2: "",
    studyGuide: "Irregularly irregular rhythm with absent P waves. Rate control with beta-blockers or nondihydropyridine calcium channel blockers is preferred in stable patients. Assess stroke vulnerability using CHA2DS2-VASc score to decide on oral anticoagulation (apixaban, rivaroxaban).",
    date: "2026-06-02"
  },
  {
    id: 3,
    qid: "4650",
    topic: "Costochondritis",
    system: "Rheumatology/Orthopedics & Sports",
    attempt1: "Correct",
    attempt2: "",
    studyGuide: "Self-limiting inflammatory condition presenting with reproducible anterior chest wall focal tenderness to palpation of the costochondral junctions. Unlike myocardial ischemia, the pain varies with respiration and posture. Rest and supportive NSAIDs provide relief.",
    date: "2026-06-02"
  },
  {
    id: 4,
    qid: "8928",
    topic: "Peripheral vascular disease",
    system: "Cardiovascular System",
    attempt1: "Correct",
    attempt2: "",
    studyGuide: "Atherosclerotic disease presenting with intermittent cramp-like claudication relieved by rest. Diagnosis is established mechanically with an Ankle-Brachial Index (ABI) <= 0.90. Management prioritizes smoking cessation, aspirin, high-intensity statin, and supervised walking therapy.",
    date: "2026-06-02"
  },
  {
    id: 5,
    qid: "2723",
    topic: "Coronary artery disease",
    system: "Cardiovascular System",
    attempt1: "Incorrect",
    attempt2: "",
    studyGuide: "Caused by plaque build-up restricting perfusion to cardiac tissues. Stable angina symptoms are typically responsive to physical exertion and relieved with sublingual nitroglycerin or rest. Vital medical management includes antiplatelets, beta blockers, and statins.",
    date: "2026-06-02"
  }
];
