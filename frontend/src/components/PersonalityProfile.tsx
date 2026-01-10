import React from 'react';
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface PersonalityTrait {
    participantId: string;
    argument_style: string;
    tone: string;
    evidence_usage: number;
    clarity: number;
    responsiveness: number;
    summary: string;
}

interface PersonalityProfileProps {
    profiles: PersonalityTrait[];
}

export const PersonalityProfile: React.FC<PersonalityProfileProps> = ({ profiles }) => {
    if (!profiles || profiles.length === 0) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
            {profiles.map((profile, index) => {
                const data = [
                    { subject: 'Evidence', A: profile.evidence_usage, fullMark: 10 },
                    { subject: 'Clarity', A: profile.clarity, fullMark: 10 },
                    { subject: 'Responsiveness', A: profile.responsiveness, fullMark: 10 },
                ];

                return (
                    <Card key={index} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-xl font-bold flex flex-col gap-1">
                                <span className="text-blue-600 dark:text-blue-400">{profile.participantId}</span>
                                <span className="text-sm font-normal text-muted-foreground">
                                    Style: {profile.argument_style} | Tone: {profile.tone}
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                                        <PolarGrid stroke="#e2e8f0" />
                                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12 }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                                        <Radar
                                            name={profile.participantId}
                                            dataKey="A"
                                            stroke="#3b82f6"
                                            fill="#3b82f6"
                                            fillOpacity={0.6}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', color: '#f3f4f6', borderRadius: '8px', border: 'none' }}
                                            itemStyle={{ color: '#60a5fa' }}
                                        />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                <p className="text-sm italic text-gray-700 dark:text-gray-300">
                                    {profile.summary}
                                </p>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-4 text-center">
                                “Personality insights are AI-generated and may not be fully accurate.”
                            </p>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
};
