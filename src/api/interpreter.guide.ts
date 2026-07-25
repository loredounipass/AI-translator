// ==========================================
// DEFINICIÓN DE TIPOS E INTERFACES
// ==========================================

export interface Metadata {
    title: string;
    subTitle: string;
    confidentialityNotice: string;
    copyright: string;
    moduleNumber: number;
}

export interface Guideline {
    rule: string;
    exception?: string;
}

export interface CultureTip {
    concept: string;
    details: string[];
    recommendations: string[];
}

export interface CulturalNuance {
    region: string;
    interpretation: string;
}

export interface NonVerbalElements {
    context: string;
    criticalElements: string[];
    examples: CulturalNuance[];
}

export interface PersonaExample {
    id: number;
    description: string;
}

export interface FirstPersonInterpretation {
    definition: string;
    keySetting: string;
    essence: string;
    examples: PersonaExample[];
}

export interface Scenario {
    id: number;
    title: string;
    context: string;
    questionsToConsider: string[];
    recommendations: string[];
}

export interface ThirdPersonRequest {
    category: string;
    phrases: string[];
}

export interface TrainingModuleData {
    metadata: Metadata;
    generalGuidelines: Guideline;
    verbalCommunication: CultureTip;
    nonVerbalCommunication: NonVerbalElements;
    firstPersonInterpretation: FirstPersonInterpretation;
    scenarios: Scenario[];
    thirdPersonRequests: ThirdPersonRequest[];
}

// ==========================================
// IMPLEMENTACIÓN DE LOS DATOS DEL MÓDULO
// ==========================================

export const INTERPETERAI_TRAINING_MODULE: TrainingModuleData = {
    metadata: {
        title: "Appropriate use of 1st and 3rd person in interpretation",
        subTitle: "Training Module interpreterai-guide",
        confidentialityNotice: "This material contains information that is proprietary and confidential to Lionbridge. It cannot be shared without written consent. DO NOT COPY. DO NOT DISTRIBUTE.",
        copyright: "interpreterai-guide",
        moduleNumber: 2
    },
    generalGuidelines: {
        rule: "Always use the first person when interpreting statements.",
        exception: "Never use the third person unless you –as the interpreter– have a request such as: 'The interpreter needs repetition'."
    },
    verbalCommunication: {
        concept: "The role of the interpreter goes beyond repeating the source language’s words into the target language; interpreters must deliver the meaning of the message in a coherent and clear fashion.",
        details: [
            "Be aware of the personal values and beliefs of your target audience; this will help you navigate possible situations you may encounter.",
            "It is important for the interpreter to know the nuances of the LEP’s culture, and this is an ongoing process that relies entirely on the interpreter. Continuing education and curiosity is key!"
        ],
        recommendations: [
            "Read publications from culturally specific regions.",
            "Listen to their music and pay attention to their lyrics.",
            "Watch their TV shows, news, soap operas, etc.",
            "Read about their history and heroes."
        ]
    },
    nonVerbalCommunication: {
        context: "Interpreters are cultural brokers and it is part of their role to be able to recognize and clarify cultural misunderstandings as they arise. When interpreters work over the phone, they have no access to the LEP’s non-verbal communication such as body language, posture, signs, etc.",
        criticalElements: [
            "Silence",
            "Hesitation",
            "Mumbling",
            "Changes in speed",
            "Voice projection",
            "Intonation"
        ],
        examples: [
            {
                region: "Some Asian cultures like the Japanese",
                interpretation: "Silence may be interpreted as a sign of deference, paying attention, or thinking thoroughly."
            },
            {
                region: "American and some European cultures",
                interpretation: "Not comfortable with silence."
            },
            {
                region: "Some Eastern European countries like Romania",
                interpretation: "Silence is interpreted as a sign that something is wrong."
            }
        ]
    },
    firstPersonInterpretation: {
        definition: "1st Person Interpretation is probably one of the most well-known and expected form in all settings.",
        keySetting: "A 'must' in the courtroom.",
        essence: "In essence, the interpreters project the persona they are interpreting for, speaking as if they were that person in that precise time of the event they are describing.",
        examples: [
            { id: 1, description: "A driver who is in distress after a car accident." },
            { id: 2, description: "An employee filing a sexual harassment complaint." }
        ]
    },
    scenarios: [
        {
            id: 1,
            title: "When can you break character?",
            context: "During a deportation case, the alien started cursing the witness, the prosecution and the Judge and, without a blink, the interpreter started cursing the witness, prosecutor and judge! The Judge stood up, stopped the recording device, stared at the interpreter and said, in front of everybody: Mr. interpreter I hope this is just a linguistic problem; I do not condone the use of such language in my courtroom under any circumstances. Let’s keep it professional!",
            questionsToConsider: [
                "Should the interpreter ask the client for permission to use foul language?",
                "Are interpreters bound to interpret everything? Even profanity?"
            ],
            recommendations: [
                "Whenever the LEP loses his or her temper, starts yelling or sobbing, or bursts into tears, don’t get upset. Remember, this is not personal.",
                "Don’t try to 'help'; your role is to interpret accurately, and convey the emotions in a professional fashion, so the client can do his/her job of 'helping' the LEP.",
                "Keep in mind that it is the client the one responsible for the process; the one 'in charge', and not you.",
                "Your job will always be to deliver the most professional renditions possible under less than ideal circumstances.",
                "Do not explain emotions or feelings, convey that flavor of the speech with your best performance. At some point, the client may even forget that there is an interpreter involved in the exchange, because you would be invisible."
            ]
        },
        {
            id: 2,
            title: "Who’s talking?",
            context: "During a commercial call, the LEP got upset about unresolved billing issues. When the Client advised the LEP that she was not able to understand the issue once again, the LEP said: 'You don’t understand because you are stupid…dumber than the previous agent I talked to'.",
            questionsToConsider: [
                "Should the interpreter break character and alert the client of the harsh comment? If so, how?",
                "Are interpreters bound to interpret everything? Even statements that may offend the parties?"
            ],
            recommendations: [
                "Be neutral. Even if the story or issue touches you, at a very personal level, detach yourself from any emotion or feeling.",
                "Convey the 'flavor of the speech' but NEVER get involved with their turmoil. It is not about you!",
                "Resist the urge to meddle. Just DON’ interfere.",
                "Be mindful of your tone. You should not inadvertently expose personal believes or opinions through your utterance.",
                "Hesitation, unnecessary pauses, and doubtful tones during your renditions may offer clues about your personal feelings on the subject to the parties; and furthermore important, this is unethical.",
                "Your job will always be to deliver the most professional renditions possible under less than ideal circumstances."
            ]
        },
        {
            id: 3,
            title: "How can I help?",
            context: "During a call with emergency services, the operator needed the address to send the ambulance to. The interpreter asked the LEP, and he said that he did not know the address, but he said it was next to an old building with columns. He was hurting, bleeding, and in need of immediate attention. Operators for emergency services can’t dispatch any units without an address.",
            questionsToConsider: [
                "Should the interpreter try to help? If so, how? This is a life-threatening situation.",
                "Can interpreters ask their own questions in order to help?"
            ],
            recommendations: [
                "Don’t try to 'help'; your role is to interpret accurately and convey the emotions in a professional fashion.",
                "The only way this client can truly and effectively help the LEP will be by making use of your professional interpretation.",
                "Keep in mind that it is the client the one responsible for asking the questions; the client is the one in charge.",
                "Remember that the client performs these tasks everyday, every hour.",
                "Your job will always be to deliver the most professional renditions possible under less than ideal circumstances."
            ]
        }
    ],
    thirdPersonRequests: [
        {
            category: "Ways to request repetition",
            phrases: [
                "The interpreter apologizes.",
                "The interpreter needs repetition.",
                "The interpreter requires a slower repetition.",
                "The interpreter would like to have you repeat the last word (or, the last sentence, the phone numbers, the social security number, etc.)",
                "The interpreter is not familiar with that vernacular expression. (to the client, first, and then immediately to the LEP)"
            ]
        },
        {
            category: "State your request",
            phrases: [
                "The interpreter apologizes.",
                "The interpreter requests for the parties to speak a little louder.",
                "The interpreter needs the client to speak closer to the microphone.",
                "The interpreter needs to alert the parties of background noise. (It is difficult for the interpreter to clearly hear what is being said)"
            ]
        },
        {
            category: "Request time",
            phrases: [
                "The interpreter apologizes.",
                "The interpreter requests 5 seconds to look up a word in a dictionary.",
                "The interpreter is having technical difficulties and needs 5 to..."
            ]
        }
    ]
};