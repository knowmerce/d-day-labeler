/**
 * d-day-labeler
 * Copyright (c) 2023-present NAVER Corp.
 * Apache-2.0
 */

import * as core from "@actions/core";
import {addLabels, getPRList, removeLabel} from "./api";
import {initialize} from "./initialize";
import type {TPRListData} from "./types";

const D_N_PATTERN = /^D-(\d+)$/;

const getNextLabel = (name: string): `D-${number | string}` => {
    const [, day] = name.match(D_N_PATTERN);
    const currentDDay = parseInt(day);
    const nextDDay = currentDDay <= 0 ? 0 : currentDDay - 1;

    return `D-${nextDDay}`;
};

interface ILabelChange {
    number: number;
    current: string;
    next: string;
}

const updateLabel = async ({number, current, next}: ILabelChange): Promise<boolean> => {
    if (current === next) {
        return false;
    }

    return Promise.all([removeLabel(number, current), addLabels(number, [next])]).then(
        () => {
            core.info(`Successfully updated label for PR #${number} from "${current}" to "${next}"`);

            return true;
        },
        error => {
            core.warning(`Failed to update label for PR #${number}: ${error.message}`);

            throw error;
        },
    );
};

const updateLabels = async (changes: ILabelChange[]): Promise<boolean[]> => {
    return Promise.all(changes.map(updateLabel));
};

const extractLabelChanges = (prList: TPRListData): ILabelChange[] => {
    return prList
        .map(({number, labels}) => ({
            number,
            dLabel: labels.find(({name}) => D_N_PATTERN.test(name))?.name,
        }))
        .filter(({dLabel}) => !!dLabel)
        .map(({number, dLabel}) => ({number, current: dLabel, next: getNextLabel(dLabel)}));
};

const run = async (): Promise<void> => {
    try {
        // 휴일은 쉽니다.
        const holidays = [
            "2024-04-10", // 국회의원 선거
            "2024-05-01", // 근로자의 날
            "2024-05-06", // 어린이날 대체공휴일
            "2024-05-15", // 부처님 오신 날
            "2024-06-06", // 현충일
            "2024-08-15", // 광복절
            "2024-09-16", // 추석
            "2024-09-17", // 추석
            "2024-09-18", // 추석
            "2024-10-03", // 개천절
            "2024-10-09", // 한글날
            "2024-12-25", // 크리스마스
        ];

        const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().substring(0, 10);

        if (holidays.includes(today)) return;

        initialize();

        const updated = await getPRList().then(extractLabelChanges).then(updateLabels);

        core.info(`Successfully updated labels for all ${updated.filter(Boolean).length} PRs.`);
    } catch (error) {
        core.setFailed((error as Error).message);
    }
};

run();
