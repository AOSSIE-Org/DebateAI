import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Brain, Lightbulb, AlertCircle, Loader2 } from 'lucide-react';
import {
    assumptionService,
    DebateAssumption,
} from '@/services/assumptionService';

interface AssumptionsProps {
    debateId: string;
    className?: string;
}

const Assumptions: React.FC<AssumptionsProps> = ({ debateId, className }) => {
    const [assumptions, setAssumptions] = useState<DebateAssumption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchAssumptions();
    }, [debateId]);

    const fetchAssumptions = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await assumptionService.getDebateAssumptions(debateId);
            setAssumptions(data.assumptions || []);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Failed to fetch assumptions'
            );
        } finally {
            setLoading(false);
        }
    };

    // Group assumptions by side
    const forSideAssumptions = assumptions.find((a) => a.side === 'for');
    const againstSideAssumptions = assumptions.find((a) => a.side === 'against');

    if (loading) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Brain className="w-5 h-5" />
                        Implicit Assumptions
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8">
                        <div className="text-center">
                            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">
                                Analyzing debate for implicit assumptions...
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Brain className="w-5 h-5" />
                        Implicit Assumptions
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="ml-2">
                            {error}
                        </AlertDescription>
                    </Alert>
                    <Button
                        onClick={fetchAssumptions}
                        variant="outline"
                        size="sm"
                        className="mt-4"
                    >
                        Try Again
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={className}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Brain className="w-5 h-5" />
                        Implicit Assumptions
                    </CardTitle>
                    <Badge variant="secondary" className="flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" />
                        AI-Generated Insights
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                {assumptions.length === 0 ? (
                    <div className="text-center py-8">
                        <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">
                            No assumptions identified
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            The AI analysis did not identify any clear implicit assumptions in
                            this debate.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* For Side Assumptions */}
                        {forSideAssumptions && forSideAssumptions.assumptions.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Badge
                                        variant="outline"
                                        className="bg-green-50 text-green-700 border-green-200"
                                    >
                                        For Side
                                    </Badge>
                                    {forSideAssumptions.participantEmail && (
                                        <span className="text-sm text-muted-foreground">
                                            {forSideAssumptions.participantEmail}
                                        </span>
                                    )}
                                </div>
                                <ul className="space-y-2">
                                    {forSideAssumptions.assumptions.map((assumption, index) => (
                                        <li
                                            key={index}
                                            className="flex gap-3 text-sm bg-muted/50 rounded-lg p-3"
                                        >
                                            <Lightbulb className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                            <span className="text-muted-foreground">{assumption}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Against Side Assumptions */}
                        {againstSideAssumptions &&
                            againstSideAssumptions.assumptions.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant="outline"
                                            className="bg-red-50 text-red-700 border-red-200"
                                        >
                                            Against Side
                                        </Badge>
                                        {againstSideAssumptions.participantEmail && (
                                            <span className="text-sm text-muted-foreground">
                                                {againstSideAssumptions.participantEmail}
                                            </span>
                                        )}
                                    </div>
                                    <ul className="space-y-2">
                                        {againstSideAssumptions.assumptions.map(
                                            (assumption, index) => (
                                                <li
                                                    key={index}
                                                    className="flex gap-3 text-sm bg-muted/50 rounded-lg p-3"
                                                >
                                                    <Lightbulb className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                                    <span className="text-muted-foreground">
                                                        {assumption}
                                                    </span>
                                                </li>
                                            )
                                        )}
                                    </ul>
                                </div>
                            )}

                        {/* Info message */}
                        <Alert className="bg-blue-50 border-blue-200">
                            <AlertCircle className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="ml-2 text-sm text-blue-800">
                                These assumptions are identified by AI and represent unstated
                                premises that may underlie the arguments. They are not
                                judgments on the validity of the arguments.
                            </AlertDescription>
                        </Alert>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default Assumptions;
