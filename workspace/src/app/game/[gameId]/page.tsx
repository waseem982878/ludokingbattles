
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Info, X, Copy, Trash2, Upload, Gamepad, Crown, TriangleAlert, Loader2, CheckCircle } from "lucide-react";
import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { getBattle, cancelBattle, uploadResult, markPlayerAsReady } from "@/services/battle-service";
import { uploadImage } from "@/services/storage-service";
import type { Battle } from "@/models/battle.model";
import LudoLaunchButton from "@/components/LudoLaunchButton";


function RulesDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-red-500 border-red-500">
            <Info className="mr-2 h-4 w-4" /> Rules
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Game Rules</DialogTitle>
          <DialogDescription>
            Follow these rules to ensure a fair and enjoyable game.
          </DialogDescription>
        </DialogHeader>
        <div className="prose dark:prose-invert max-w-none text-foreground">
            <ul className="space-y-3 text-sm list-disc list-inside">
                <li>
                    <strong>Room Code:</strong> After joining a battle, the creator will enter a Ludo King room code. You must join the room in the Ludo King app using this code.
                </li>
                <li>
                    <strong>Gameplay:</strong> The game must be played according to standard Ludo King classic rules.
                </li>
                <li>
                    <strong>Winning Proof:</strong> After winning the game, you MUST take a screenshot of the final win screen in Ludo King.
                </li>
                <li>
                    <strong>Uploading Result:</strong> Upload the winning screenshot in the "Game Result" section of the app. The winner gets the prize money after verification.
                </li>
                 <li>
                    <strong>Cheating:</strong> Any form of cheating, including using mods or teaming up, will result in an immediate ban and forfeiture of all wallet funds.
                </li>
                <li>
                    <strong>Disputes:</strong> If there is any issue, contact support immediately. Any attempt at fraud will result in a permanent ban.
                </li>
                 <li>
                    <strong>Cancellation:</strong> If you cancel a challenge after an opponent has joined, a penalty fee will be deducted from your wallet.
                </li>
            </ul>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ResultModal({ status, onClose, battle, onResultSubmitted }: { status: 'won' | 'lost' | null, onClose: () => void, battle: Battle, onResultSubmitted: (status: 'won' | 'lost') => void }) {
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setImage(file);
          const reader = new FileReader();
          reader.onloadend = () => {
              setImagePreview(reader.result as string);
          }
          reader.readAsDataURL(file);
      }
  }

  const handleSubmit = async () => {
    if (!user || !status) return;
    setIsSubmitting(true);
    try {
        if (status === 'won') {
            if (!image) {
                alert("Please upload a screenshot.");
                setIsSubmitting(false);
                return;
            }
            const imageUrl = await uploadImage(image, `results/${battle.id}/${user.uid}`);
            await uploadResult(battle.id, user.uid, 'won', imageUrl);
            alert("Result submitted for verification.");
        } else if (status === 'lost') {
            await uploadResult(battle.id, user.uid, 'lost'); // special marker for loss
            alert("Loss confirmed. Better luck next time!");
        }
        onResultSubmitted(status);
        onClose();
    } catch (error) {
        console.error("Error submitting result:", error);
        alert("Failed to submit result.");
    } finally {
        setIsSubmitting(false);
    }
  }

  if (!status) return null;

  return (
    <Dialog open={!!status} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">
            {status === 'won' ? 'You Won! 🎉' : 'You Lost 😔'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
            {status === 'won' && (
                <>
                <p className="text-center text-muted-foreground">Upload a screenshot of the win screen as proof.</p>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                <Card 
                    className="border-dashed border-2 hover:border-primary cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <CardContent className="p-6 flex flex-col items-center justify-center">
                        {imagePreview ? (
                           <Image src={imagePreview} alt="Screenshot preview" width={200} height={200} className="rounded-md max-h-48 w-auto" />
                        ) : (
                            <div className="text-center">
                                <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                                <p className="mt-2 text-sm text-muted-foreground">Click to upload screenshot</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
                </>
            )}
            {status === 'lost' && (
                 <p className="text-center text-muted-foreground">Better luck next time! Confirming your loss will conclude the battle.</p>
            )}
          
          <Button 
            className={`w-full ${status === 'won' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
            disabled={(status === 'won' && !image) || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : null}
            {status === 'won' ? 'Submit Proof' : 'Confirm Loss'}
          </Button>
          <DialogClose asChild>
              <Button variant="outline" className="w-full" onClick={onClose}>Cancel</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function GameRoomPage({ params }: { params: { gameId: string } }) {
  const router = useRouter();
  const { gameId } = params;
  const { user, userProfile } = useAuth();
  
  const [battle, setBattle] = useState<Battle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resultStatus, setResultStatus] = useState<'won' | 'lost' | null>(null);
  const [isMarkingReady, setIsMarkingReady] = useState(false);

  useEffect(() => {
    if (!gameId || !user) {
        return;
    };
    const unsubscribe = getBattle(gameId, (battleData) => {
        if (battleData) {
            setBattle(battleData);
        } else {
            setError("Battle not found or has been cancelled.");
            setTimeout(() => router.push('/play'), 3000);
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, [gameId, user, router]);

  const handleCopy = () => {
    if (battle?.roomCode) {
      navigator.clipboard.writeText(battle.roomCode);
      alert("Room code copied!");
    }
  };
  
  const handleCancel = async () => {
    if (!battle || !user) return;
    if (confirm("Are you sure you want to cancel this battle? A penalty may be applied.")) {
      try {
        await cancelBattle(battle.id, user.uid, battle.creator.id, battle.amount);
        alert("Battle cancelled.");
        router.push('/play');
      } catch (err) {
        console.error(err);
        alert("Failed to cancel battle.");
      }
    }
  };
  
  const handleReady = async () => {
    if (!battle || !user) return;
    setIsMarkingReady(true);
    try {
        await markPlayerAsReady(battle.id, user.uid);
    } catch (err) {
        console.error(err);
        alert("Could not mark as ready.");
    } finally {
        setIsMarkingReady(false);
    }
  }

  const onResultSubmitted = () => {
      // The local battle state will be updated by the onSnapshot listener
      console.log('Result submission triggered update.');
  }

  if (loading || !userProfile) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>;
  }

  if (error || !battle || !user || !battle.opponent) {
    return <div className="text-center py-10 text-red-500">{error || "Could not load battle details."}</div>;
  }

  const creator = battle.creator;
  const opponent = user.uid === creator.id ? battle.opponent : creator;

  const hasUserSubmittedResult = user && battle.result && battle.result[user.uid];
  const isPlayerReady = user && battle.readyPlayers && battle.readyPlayers[user.uid];

  const getStatusMessage = () => {
      if (hasUserSubmittedResult) {
           return "Your result has been submitted. Waiting for opponent and verification.";
      }
      if (battle.status === 'result_pending') {
          return "Opponent has submitted the result. Please submit yours.";
      }
      if (battle.status === 'inprogress') {
         return "After your game ends, post the result below. Dishonesty will result in a ban.";
      }
      return "Game is about to start. Get ready!";
  }
  
   const renderGameControl = () => {
        if (!battle.roomCode) {
             return (
                <div className='text-center py-4'>
                    <p className="text-lg font-semibold my-2">Waiting for creator to share code...</p>
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
            )
        }

        if (battle.status === 'waiting_for_players_ready') {
            if (isPlayerReady) {
                return (
                    <div className='text-center py-4'>
                        <p className="text-lg font-semibold my-2 text-green-600">You are ready!</p>
                        <p>Waiting for opponent to confirm...</p>
                    </div>
                );
            }
            return (
                 <div className="text-center py-4 space-y-4">
                    <p className="font-semibold">Join the room in Ludo King and click Ready when you are in.</p>
                     <Button className="w-full bg-green-500 hover:bg-green-600 text-white" onClick={handleReady} disabled={isMarkingReady}>
                        {isMarkingReady ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                         I'm Ready
                     </Button>
                </div>
            )
        }

        if (battle.status === 'inprogress') {
            return <LudoLaunchButton roomCode={battle.roomCode}/>
        }

        return <p className="text-center text-muted-foreground">The game will begin shortly.</p>
    }


  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Button onClick={() => router.back()} variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <RulesDialog />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center text-center mb-4">
              <div className="flex flex-col items-center gap-1">
                  <Image src={opponent.avatarUrl} alt={opponent.name} width={40} height={40} className="rounded-full ring-2 ring-muted" data-ai-hint="user avatar" />
                  <span className="font-semibold text-sm">{opponent.name}</span>
              </div>
              <div className="text-center">
                  <p className="text-orange-500 font-bold text-xl">VS</p>
                  <p className="font-bold text-green-600">₹ {battle.amount}</p>
              </div>
              <div className="flex flex-col items-center gap-1">
                   <Image src={userProfile?.avatarUrl || 'https://picsum.photos/40/40'} alt="You" width={40} height={40} className="rounded-full ring-2 ring-primary" data-ai-hint="user avatar" />
                  <span className="font-semibold text-sm">You</span>
              </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-center">
              {battle.roomCode ? (
                <>
                    <p className="text-sm text-muted-foreground">Room Code</p>
                    <div className="flex justify-center items-center gap-2 my-2">
                        <p className="text-4xl font-bold tracking-widest text-primary">{battle.roomCode}</p>
                        <Button variant="ghost" size="icon" onClick={handleCopy}>
                            <Copy className="w-6 h-6" />
                        </Button>
                    </div>
                    {renderGameControl()}
                </>
              ) : (
                <div className='text-center py-4'>
                    <p className="text-lg font-semibold my-2">Waiting for creator to share code...</p>
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
              )}
          </div>
        </CardContent>
      </Card>
      
       {(battle.status === 'inprogress' || battle.status === 'result_pending' || battle.status === 'completed') && (
            <Card>
                <CardHeader>
                  <CardTitle className="text-center text-lg">Game Result</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-center text-sm text-muted-foreground">{getStatusMessage()}</p>
                    <Button onClick={() => setResultStatus('won')} className="w-full bg-green-600 hover:bg-green-700" disabled={!!hasUserSubmittedResult}>
                        <Crown className="mr-2 h-4 w-4" /> I WON
                    </Button>
                    <Button onClick={() => setResultStatus('lost')} className="w-full bg-red-600 hover:bg-red-700" disabled={!!hasUserSubmittedResult}>
                       <Gamepad className="mr-2 h-4 w-4" /> I LOST
                    </Button>
                    <Button variant="outline" className="w-full" onClick={handleCancel}>
                        <Trash2 className="mr-2 h-4 w-4" /> CANCEL BATTLE
                    </Button>
                </CardContent>
            </Card>
       )}
      
      <div className="border border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg space-y-2">
        <h3 className="font-bold text-yellow-700 dark:text-yellow-300 flex items-center gap-2"><TriangleAlert className="h-5 w-5"/> Important Note</h3>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 pl-2">
            <li>A penalty will be applied for submitting a wrong or edited screenshot.</li>
            <li>Any abusive language or fraudulent activity will result in a permanent ban.</li>
            <li>If you cancel after the opponent joins, a penalty will be deducted from your wallet.</li>
        </ul>
      </div>

      <ResultModal status={resultStatus} onClose={() => setResultStatus(null)} battle={battle} onResultSubmitted={onResultSubmitted} />
    </div>
  );
}
