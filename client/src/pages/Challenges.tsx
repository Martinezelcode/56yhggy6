import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useBlockchainChallenge } from "@/hooks/useBlockchainChallenge";
import { cn } from "@/lib/utils";
import { getGlobalChannel } from "@/lib/pusher";
import { MobileNavigation } from "@/components/MobileNavigation";
import { ChallengeCard } from "@/components/ChallengeCard";
import { ChallengeChat } from "@/components/ChallengeChat";
import { JoinChallengeModal } from "@/components/JoinChallengeModal";
import { ChallengePreviewCard } from "@/components/ChallengePreviewCard";
import { BantMap } from "@/components/BantMap";
import { Button } from "@/components/ui/button";
import CategoryBar from "@/components/CategoryBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { UserAvatar } from "@/components/UserAvatar";
import {
  MessageCircle,
  Clock,
  Trophy,
  TrendingUp,
  Zap,
  Users,
  Shield,
  Search,
  Check,
  X,
  ImagePlus,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

function ChallengeCardSkeleton() {
  return (
    <Card className="overflow-hidden min-h-[160px] bg-white dark:bg-slate-900 shadow-sm rounded-2xl animate-pulse border-0">
      <CardContent className="p-4 flex flex-col h-full space-y-4">
        <div className="flex items-center space-x-3">
          <Skeleton className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4 rounded-full bg-slate-200 dark:bg-slate-800" />
            <Skeleton className="h-3 w-1/2 rounded-full bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800/50" />
          <Skeleton className="h-3 w-5/6 rounded-full bg-slate-100 dark:bg-slate-800/50" />
        </div>
        <div className="pt-2 flex justify-between items-center">
          <Skeleton className="h-6 w-16 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <Skeleton className="h-4 w-12 rounded-full bg-slate-100 dark:bg-slate-800/50" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Challenges() {
  const { user, getAccessToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [opponentSearchTerm, setOpponentSearchTerm] = useState("");
  const [selectedChallenge, setSelectedChallenge] = useState<any>(null);
  const [showChat, setShowChat] = useState(false);
  const [challengeStatusTab, setChallengeStatusTab] = useState<'all' | 'open' | 'active' | 'pending' | 'completed' | 'ended'>('all');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState<string>('featured');
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [preSelectedUser, setPreSelectedUser] = useState<any>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [createFormData, setCreateFormData] = useState({
    title: '',
    description: '',
    category: 'general',
    amount: 0 as number, // Allow decimals for ETH support
    challengeType: 'open', // 'open' or 'direct'
    opponentId: null as string | null,
    dueDate: '' as string, // ISO string
    paymentToken: 'ETH' as 'ETH' | 'USDT' | 'USDC', // Token selection
    side: 'YES' as 'YES' | 'NO', // Creator's chosen side
    coverImage: null as File | null,
  });

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/gif', 'image/svg+xml', 'image/jpeg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: 'Invalid format',
          description: 'Please use GIF, SVG, JPEG, or PNG format',
          variant: 'destructive',
        });
        return;
      }

      // Validate file size (max 2MB)
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        toast({
          title: 'File too large',
          description: 'Image must be less than 2MB',
          variant: 'destructive',
        });
        return;
      }

      // For SVG and GIF, skip compression
      if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
        setCreateFormData({ ...createFormData, coverImage: file });
        const reader = new FileReader();
        reader.onloadend = () => {
          setCoverImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
        return;
      }

      // Compress JPEG and PNG
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize if larger than 1000x1000
        if (width > 1000 || height > 1000) {
          const ratio = Math.min(1000 / width, 1000 / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: file.lastModified,
                });
                setCreateFormData({ ...createFormData, coverImage: compressedFile });
                const reader = new FileReader();
                reader.onloadend = () => {
                  setCoverImagePreview(reader.result as string);
                };
                reader.readAsDataURL(blob);
              }
            },
            'image/jpeg',
            0.8
          );
        }
      };
      img.src = URL.createObjectURL(file);
    }
  };

  // Listen for header search events dispatched from Navigation
  useEffect(() => {
    const onSearch = (e: any) => {
      const val = e?.detail ?? "";
      setSearchTerm(val);
    };
    const onOpen = () => setIsSearchOpen(true);

    window.addEventListener("challenges-search", onSearch as EventListener);
    window.addEventListener("open-challenges-search", onOpen as EventListener);

    return () => {
      window.removeEventListener("challenges-search", onSearch as EventListener);
      window.removeEventListener("open-challenges-search", onOpen as EventListener);
    };
  }, []);

  const { data: challenges = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/challenges"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/challenges/public", {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`${response.status}: ${await response.json().then(e => e.message).catch(() => "Unknown error")}`);
        }
        const data = await response.json();
        // Ensure data is always an array
        if (!Array.isArray(data)) {
          console.error("Expected array from /api/challenges/public, got:", data);
          return [];
        }
        return data.map((challenge: any) => ({
          ...challenge,
          commentCount: challenge.commentCount ?? 0,
          participantCount: challenge.participantCount ?? 0,
        }));
      } catch (error: any) {
        console.error("Error fetching challenges:", error);
        return [];
      }
    },
    retry: false,
  });

  const { data: friends = [] as any[] } = useQuery({
    queryKey: ["/api/friends"],
    retry: false,
    enabled: !!user, // Only fetch when user is authenticated
  });

  const {
    data: allUsers = [] as any[],
    isLoading: usersLoading,
    error: usersError,
  } = useQuery({
    queryKey: ["/api/users"],
    retry: false,
    enabled: !!user, // Only fetch when user is authenticated
  });

  const { data: balance = 0 } = useQuery<any>({
    queryKey: ["/api/wallet/balance"],
    retry: false,
  });

  // Real-time listeners for challenge updates via Pusher
  useEffect(() => {
    const globalChannel = getGlobalChannel();
    
    // Listen for new challenge messages
    const handleNewMessage = (data: any) => {
      if (data.type === 'challenge_message' || data.challengeId) {
        queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
      }
    };

    // Listen for when users join challenges  
    const handleChallengeJoined = (data: any) => {
      if (data.type === 'challenge_joined' || data.challengeId) {
        queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
      }
    };

    globalChannel.bind('new-message', handleNewMessage);
    globalChannel.bind('challenge-joined', handleChallengeJoined);

    return () => {
      globalChannel.unbind('new-message', handleNewMessage);
      globalChannel.unbind('challenge-joined', handleChallengeJoined);
      globalChannel.unsubscribe();
    };
  }, [queryClient]);

  const { createP2PChallenge } = useBlockchainChallenge();

  // Token address mapping for Base Sepolia
  // NOTE: Use address(0) for native ETH
  const TOKEN_ADDRESSES: Record<'ETH' | 'USDT' | 'USDC', string> = {
    'ETH': '0x0000000000000000000000000000000000000000', // Native ETH (zero address)
    'USDT': '0x9eba6af5f65ecb20e65c0c9e0b5cdbbbe9c5c00c0', // USDT on Base Sepolia
    'USDC': '0x036cbd53842c5426634e7929541ec2318f3dcf7e', // USDC on Base Sepolia
  };

  const createChallengeMutation = useMutation({
    mutationFn: async (formData: typeof createFormData) => {
      // Validate required fields
      if (!formData.title || formData.title.trim().length === 0) {
        throw new Error('Please enter a challenge title');
      }

      if (formData.amount <= 0) {
        throw new Error(`Please enter a valid amount (minimum 0.000001 ${formData.paymentToken})`);
      }

      if (formData.challengeType === 'direct' && !preSelectedUser) {
        throw new Error('Please select an opponent for direct challenges');
      }

      // Both Direct and Open challenges need blockchain signing
      // Convert amount to wei based on token decimals: ETH = 18 decimals, USDC/USDT = 6 decimals
      const decimals = formData.paymentToken === 'ETH' ? 1e18 : 1e6;
      const stakeWeiValue = String(Math.floor(formData.amount * decimals));
      const pointsRewardValue = "500";

      // Get selected token address
      const selectedTokenAddress = TOKEN_ADDRESSES[formData.paymentToken];

      console.log(`📝 Creating ${formData.paymentToken} challenge:`);
      console.log(`   Amount: ${formData.amount} ${formData.paymentToken}`);
      console.log(`   Stake (wei): ${stakeWeiValue}`);
      console.log(`   Decimals: ${decimals}`);

      toast({
        title: "Creating Challenge",
        description: `Please sign the transaction in your wallet (${formData.paymentToken})...`,
      });

      // For open challenges, use zero address to indicate "anyone can join"
      const opponentAddress = formData.challengeType === 'direct' 
        ? (preSelectedUser?.primaryWalletAddress || preSelectedUser?.walletAddress || preSelectedUser?.id)
        : '0x0000000000000000000000000000000000000000'; // Zero address for open challenges

      const txResult = await createP2PChallenge({
        opponentAddress,
        stakeAmount: stakeWeiValue,
        paymentToken: selectedTokenAddress,
        pointsReward: pointsRewardValue,
        metadataURI: 'ipfs://bafytest',
      });

      if (!txResult) {
        throw new Error('Transaction failed or was cancelled');
      }

      // Step 2: Store challenge in database ONLY after successful blockchain transaction
      // Use FormData to support file uploads
      const requestBody = new FormData();
      requestBody.append('opponentId', formData.challengeType === 'direct' ? preSelectedUser?.id : '');
      requestBody.append('title', formData.title);
      requestBody.append('description', formData.description);
      requestBody.append('stakeAmount', formData.amount.toString());
      requestBody.append('paymentToken', selectedTokenAddress);
      requestBody.append('dueDate', formData.dueDate || '');
      requestBody.append('metadataURI', 'ipfs://bafytest');
      requestBody.append('challengeType', formData.challengeType);
      requestBody.append('transactionHash', txResult.transactionHash);
      requestBody.append('side', formData.side);
      if (formData.coverImage) {
        requestBody.append('coverImage', formData.coverImage);
      }

      // Get the Privy auth token
      const token = await getAccessToken();
      
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/challenges/create-p2p', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: requestBody,
      });

      console.log(`📡 API Response Status: ${response.status} ${response.statusText}`);
      console.log(`🔐 Auth header sent: ${token ? 'Yes' : 'No'}`);
      
      if (!response.ok) {
        let errorMessage = `API Error ${response.status}`;
        try {
          const error = await response.json();
          errorMessage = error.message || error.error || errorMessage;
          console.error(`❌ API Error Details:`, error);
        } catch (e) {
          const text = await response.text();
          console.error(`❌ API Error (non-JSON):`, text);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log(`✅ Challenge created successfully:`, data);
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Challenge Created",
        description: "Your blockchain challenge has been created!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
      setIsCreateDialogOpen(false);
      setCreateFormData({ title: '', description: '', category: 'general', amount: 0, challengeType: 'open', opponentId: null, dueDate: '', paymentToken: 'ETH', side: 'YES', coverImage: null });
      setCoverImagePreview(null);
      setPreSelectedUser(null);
    },
    onError: (error: Error) => {
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        toast({
          title: "Unauthorized",
          description: "Please log in to create a challenge",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Error",
        description: error.message || 'Failed to create challenge',
        variant: "destructive",
      });
    },
  });

  const categories = [
    { id: "create", label: "Create", icon: "/assets/create.png", gradient: "from-green-400 to-emerald-500", isCreate: true, value: "create" },
    { id: "all", label: "All", icon: "/assets/versus.svg", gradient: "from-blue-400 to-purple-500", value: "all" },
    { id: "sports", label: "Sports", icon: "/assets/sportscon.svg", gradient: "from-green-400 to-blue-500", value: "sports" },
    { id: "gaming", label: "Gaming", icon: "/assets/gamingsvg.svg", gradient: "from-gray-400 to-gray-600", value: "gaming" },
    { id: "crypto", label: "Crypto", icon: "/assets/cryptosvg.svg", gradient: "from-yellow-400 to-orange-500", value: "crypto" },
    { id: "trading", label: "Trading", icon: "/assets/cryptosvg.svg", gradient: "from-yellow-400 to-orange-500", value: "trading" },
    { id: "music", label: "Music", icon: "/assets/musicsvg.svg", gradient: "from-blue-400 to-purple-500", value: "music" },
    { id: "entertainment", label: "Entertainment", icon: "/assets/popcorn.svg", gradient: "from-pink-400 to-red-500", value: "entertainment" },
    { id: "politics", label: "Politics", icon: "/assets/poltiii.svg", gradient: "from-green-400 to-teal-500", value: "politics" },
  ];

  const filteredChallenges = challenges.filter((challenge: any) => {
    const searchLower = searchTerm ? searchTerm.toLowerCase() : "";
    const matchesSearch =
      !searchTerm ||
      (challenge.title || "").toLowerCase().includes(searchLower) ||
      (challenge.description || "").toLowerCase().includes(searchLower) ||
      (challenge.category || "").toLowerCase().includes(searchLower) ||
      (challenge.challengerUser?.username || "")
        .toLowerCase()
        .includes(searchLower) ||
      (challenge.challengedUser?.username || "")
        .toLowerCase()
        .includes(searchLower);

    const matchesCategory =
      selectedCategory === "all" || challenge.category === selectedCategory;

    // Determine admin-created flag explicitly
    const isAdminCreated = challenge.adminCreated === true;

    // Filter by challenge status or P2P tab
    const matchesStatus =
      challengeStatusTab === 'all' ? true :
      (challengeStatusTab as string) === 'p2p' ? !isAdminCreated :
      challengeStatusTab === 'open' ? challenge.status === 'open' :
      challengeStatusTab === 'active' ? challenge.status === 'active' :
      challengeStatusTab === 'pending' ? challenge.status === 'pending' :
      challengeStatusTab === 'completed' ? challenge.status === 'completed' :
      challengeStatusTab === 'ended' ? (challenge.status === 'completed' || challenge.status === 'cancelled' || challenge.status === 'disputed') :
      true;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const filteredUsers = (allUsers as any[]).filter((u: any) => {
    if (!opponentSearchTerm || u.id === user?.id) return false;
    if (u.isAdmin) return false;
    const searchLower = opponentSearchTerm.toLowerCase();
    const firstName = (u.firstName || "").toLowerCase();
    const lastName = (u.lastName || "").toLowerCase();
    const username = (u.username || "").toLowerCase();
    const fullName = `${firstName} ${lastName}`.trim().toLowerCase();
    const walletAddress = (u.primaryWalletAddress || "").toLowerCase();

    return (
      firstName.includes(searchLower) ||
      lastName.includes(searchLower) ||
      username.includes(searchLower) ||
      fullName.includes(searchLower) ||
      walletAddress.includes(searchLower)
    );
  });

  const pendingChallenges = filteredChallenges.filter(
    (c: any) => c.status === "pending" && !c.adminCreated && (c.challengerId === user?.id || c.challengedId === user?.id),
  );
  const activeChallenges = filteredChallenges.filter(
    (c: any) => c.status === "active" && !c.adminCreated,
  );
  const awaitingResolutionChallenges = filteredChallenges.filter(
    (c: any) => c.status === "pending_admin" && c.adminCreated && (c.challengerId === user?.id || c.challengedId === user?.id || c.creatorId === user?.id),
  );
  const completedChallenges = filteredChallenges.filter(
    (c: any) => c.status === "completed" && !c.adminCreated,
  );
  const featuredChallenges = filteredChallenges.filter(
    (c: any) => c.adminCreated && c.status !== "pending_admin",
  );

  // Validate selected tab - reset to featured if current tab is hidden
  useEffect(() => {
    const isTabVisible = 
      selectedTab === 'featured' || 
      selectedTab === 'active' ||
      selectedTab === 'completed' ||
      (user && selectedTab === 'pending' && pendingChallenges.length > 0) ||
      (user && selectedTab === 'awaiting_resolution' && awaitingResolutionChallenges.length > 0);
    
    if (!isTabVisible) {
      setSelectedTab('featured');
    }
  }, [selectedTab, user, pendingChallenges.length, awaitingResolutionChallenges.length]);

  const onSubmit = (data: any) => {
    const amount = parseFloat(data.amount);
    const currentBalance =
      balance && typeof balance === "object" ? (balance as any).balance : balance;

    if (amount > currentBalance) {
      toast({
        title: "Insufficient Balance",
        description: "You don't have enough funds to create this challenge.",
        variant: "destructive",
      });
      return;
    }

    createChallengeMutation.mutate(data);
  };

  const handleChallengeClick = (challenge: any) => {
    // Navigate to the challenge activity page instead of opening the modal.
    // This allows users to view the activity page even if they're not a participant.
    window.location.href = `/challenges/${challenge.id}/activity`;
  };

  const handleJoin = (challenge: any) => {
    setSelectedChallenge(challenge);
    setShowJoinModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500";
      case "active":
        return "bg-green-500";
      case "completed":
        return "bg-blue-500";
      case "disputed":
        return "bg-red-500";
      case "cancelled":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return Clock;
      case "active":
        return Zap;
      case "completed":
        return Trophy;
      case "disputed":
        return Shield;
      default:
        return Clock;
    }
  };

  // Handle authentication errors
  useEffect(() => {
    if (usersError && isUnauthorizedError(usersError as Error)) {
      toast({
        title: "Session Expired",
        description: "Please log in again to continue.",
        variant: "destructive",
      });
    }
  }, [usersError, toast]);

  if (!user) {
    // Allow unauthenticated users to view challenges but show login prompts for actions
  }

  const sortedChallenges = [...filteredChallenges].sort((a: any, b: any) => {
    // Priority 0: Pinned challenges first
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;

    // Priority 1: Pending (Action Required)
    const aIsPending = a.status === 'pending' && !a.adminCreated && (a.challengerId === user?.id || a.challengedId === user?.id);
    const bIsPending = b.status === 'pending' && !b.adminCreated && (b.challengerId === user?.id || b.challengedId === user?.id);
    if (aIsPending && !bIsPending) return -1;
    if (!aIsPending && bIsPending) return 1;

    // Priority 2: Active/Live
    const aIsActive = a.status === 'active';
    const bIsActive = b.status === 'active';
    if (aIsActive && !bIsActive) return -1;
    if (!aIsActive && bIsActive) return 1;

    // Priority 3: Featured/Open (Admin created matches)
    const aIsOpen = a.status === 'open' && a.adminCreated;
    const bIsOpen = b.status === 'open' && b.adminCreated;
    if (aIsOpen && !bIsOpen) return -1;
    if (!aIsOpen && bIsOpen) return 1;

    // Priority 4: Awaiting Resolution
    const aIsAwaiting = a.status === 'pending_admin';
    const bIsAwaiting = b.status === 'pending_admin';
    if (aIsAwaiting && !bIsAwaiting) return -1;
    if (!aIsAwaiting && bIsAwaiting) return 1;

    // Default: Newest first
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 theme-transition pb-[50px]">
      <div className="max-w-7xl mx-auto px-3 md:px-4 sm:px-6 lg:px-8 py-2 md:py-4">
        <CategoryBar
          categories={categories}
          selectedCategory={selectedCategory}
          onSelect={(id) => {
            if (id === 'create') {
              setIsCreateDialogOpen(true);
              return;
            }
            setSelectedCategory(id);
          }}
        />

        {/* Challenge Status Tabs */}
        <div className="overflow-x-auto scrollbar-hide -mx-3 px-3 pb-1 md:flex md:justify-center">
          <Tabs 
            defaultValue="all" 
            value={challengeStatusTab} 
            onValueChange={(val) => setChallengeStatusTab(val as any)} 
            className="w-full md:w-auto"
          >
            <TabsList className="inline-flex w-fit h-8 border-0 shadow-none bg-transparent gap-1 items-center">
              <TabsTrigger 
                value="all" 
                className="text-xs px-3 py-1.5 rounded-full data-[state=active]:bg-[#7440ff] data-[state=active]:text-white whitespace-nowrap bg-white dark:bg-slate-800 transition-all h-auto"
              >
                All
              </TabsTrigger>
              <TabsTrigger 
                value="p2p" 
                className="text-xs px-3 py-1.5 rounded-full data-[state=active]:bg-[#7440ff] data-[state=active]:text-white whitespace-nowrap bg-white dark:bg-slate-800 transition-all h-auto"
              >
                P2P
              </TabsTrigger>
              <TabsTrigger 
                value="open" 
                className="text-xs px-3 py-1.5 rounded-full data-[state=active]:bg-[#7440ff] data-[state=active]:text-white whitespace-nowrap bg-white dark:bg-slate-800 transition-all h-auto"
              >
                Open
              </TabsTrigger>
              <TabsTrigger 
                value="active" 
                className="text-xs px-3 py-1.5 rounded-full data-[state=active]:bg-[#7440ff] data-[state=active]:text-white whitespace-nowrap bg-white dark:bg-slate-800 transition-all h-auto"
              >
                Active
              </TabsTrigger>
              <TabsTrigger 
                value="pending" 
                className="text-xs px-3 py-1.5 rounded-full data-[state=active]:bg-[#7440ff] data-[state=active]:text-white whitespace-nowrap bg-white dark:bg-slate-800 transition-all h-auto"
              >
                Pending
              </TabsTrigger>
              <TabsTrigger 
                value="completed" 
                className="text-xs px-3 py-1.5 rounded-full data-[state=active]:bg-[#7440ff] data-[state=active]:text-white whitespace-nowrap bg-white dark:bg-slate-800 transition-all h-auto"
              >
                Completed
              </TabsTrigger>
              <TabsTrigger 
                value="ended" 
                className="text-xs px-3 py-1.5 rounded-full data-[state=active]:bg-[#7440ff] data-[state=active]:text-white whitespace-nowrap bg-white dark:bg-slate-800 transition-all h-auto"
              >
                Ended
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
              {[...Array(6)].map((_, i) => (
                <ChallengeCardSkeleton key={i} />
              ))}
            </div>
          ) : sortedChallenges.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
              {sortedChallenges.map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  onChatClick={handleChallengeClick}
                  onJoin={handleJoin}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                <img 
                  src="/assets/bantahsearch.png" 
                  alt="No challenges" 
                  className="w-8 h-8 object-contain"
                />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No challenges found</h3>
              <p className="text-slate-500 dark:text-slate-400">Try adjusting your search or category filters</p>
            </div>
          )}
        </div>

        <Dialog
          open={isCreateDialogOpen}
          onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) {
              setPreSelectedUser(null);
            }
          }}
        >
      <DialogContent className="max-w-[360px] p-3 overflow-hidden border-none shadow-2xl rounded-xl bg-white dark:bg-slate-900">
        <div className="space-y-2">
          <DialogHeader className="pb-0">
            <DialogTitle className="text-base font-bold text-center">Create Challenge</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            {/* Type Selector */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={createFormData.challengeType === 'open' ? 'default' : 'outline'}
                className={cn(
                  "h-7 text-[10px] rounded-md transition-all font-semibold",
                  createFormData.challengeType === 'open' ? "bg-[#7440FF] text-white hover:bg-[#7440FF]" : "border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
                onClick={() => setCreateFormData({ ...createFormData, challengeType: 'open' })}
              >
                Open
              </Button>
              <Button
                variant={createFormData.challengeType === 'direct' ? 'default' : 'outline'}
                className={cn(
                  "h-7 text-[10px] rounded-md transition-all font-semibold",
                  createFormData.challengeType === 'direct' ? "bg-[#7440FF] text-white hover:bg-[#7440FF]" : "border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
                onClick={() => setCreateFormData({ ...createFormData, challengeType: 'direct' })}
              >
                P2P
              </Button>
            </div>

            {/* Title */}
            <Input
              placeholder="Challenge title"
              className="rounded-md border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:ring-1 focus:ring-[#ccff00] h-7 text-xs"
              value={createFormData.title}
              onChange={(e) => setCreateFormData({ ...createFormData, title: e.target.value })}
            />

            {/* Category & Amount Row */}
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={createFormData.category}
                onValueChange={(val) => setCreateFormData({ ...createFormData, category: val })}
              >
                <SelectTrigger className="rounded-md border-0 bg-slate-50/50 dark:bg-slate-950/50 h-7 text-xs">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="rounded-md border-0 bg-white dark:bg-slate-900 shadow-xl">
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="sports">Sports</SelectItem>
                  <SelectItem value="gaming">Gaming</SelectItem>
                  <SelectItem value="crypto">Crypto</SelectItem>
                  <SelectItem value="trading">Trading</SelectItem>
                  <SelectItem value="music">Music</SelectItem>
                  <SelectItem value="entertainment">Entertainment</SelectItem>
                  <SelectItem value="politics">Politics</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="number"
                step="0.000001"
                min="0"
                max="1000000"
                placeholder={`Amount (${createFormData.paymentToken})`}
                className="rounded-md border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:ring-1 focus:ring-[#ccff00] h-7 text-xs"
                value={createFormData.amount === 0 ? '' : createFormData.amount}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  // Allow empty string or any number input (validation happens on submit)
                  if (inputValue === '') {
                    setCreateFormData({ ...createFormData, amount: 0 });
                  } else {
                    const val = parseFloat(inputValue);
                    // Allow any valid number to be set (including intermediate values like "0." or "0.0")
                    if (!isNaN(val)) {
                      setCreateFormData({ ...createFormData, amount: val });
                    }
                  }
                }}
              />
            </div>

            {/* Side Selection */}
            <div className="flex gap-1.5">
              <Button
                variant={createFormData.side === 'YES' ? 'default' : 'outline'}
                className={cn(
                  "flex-1 h-7 rounded-md transition-all text-[10px] font-semibold",
                  createFormData.side === 'YES' ? "bg-green-500 text-white hover:bg-green-600" : "border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
                onClick={() => setCreateFormData({ ...createFormData, side: 'YES' })}
              >
                YES
              </Button>
              <Button
                variant={createFormData.side === 'NO' ? 'default' : 'outline'}
                className={cn(
                  "flex-1 h-7 rounded-md transition-all text-[10px] font-semibold",
                  createFormData.side === 'NO' ? "bg-red-500 text-white hover:bg-red-600" : "border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
                onClick={() => setCreateFormData({ ...createFormData, side: 'NO' })}
              >
                NO
              </Button>
            </div>

            {/* Payment Token Selection */}
            <div className="flex gap-1">
              {['ETH', 'USDT', 'USDC'].map((token) => (
                <Button
                  key={token}
                  variant="outline"
                  className={cn(
                    "flex-1 rounded-full px-1 h-6 text-[9px] border-slate-200 dark:border-slate-800 transition-all font-semibold",
                    createFormData.paymentToken === token ? "bg-[#7440FF] text-white border-[#7440FF] hover:bg-[#7440FF]" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                  onClick={() => setCreateFormData({ ...createFormData, paymentToken: token as 'ETH' | 'USDT' | 'USDC' })}
                >
                  {token}
                </Button>
              ))}
            </div>

            {/* Date Field */}
            <Input
              type="datetime-local"
              placeholder="Due date (optional)"
              className="rounded-md border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:ring-1 focus:ring-[#ccff00] h-7 text-xs"
              value={createFormData.dueDate}
              onChange={(e) => setCreateFormData({ ...createFormData, dueDate: e.target.value })}
              min={new Date().toISOString().slice(0, 16)}
            />

            {/* Cover Image Upload */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Event Banner</label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer bg-slate-50/50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-2 pb-2">
                    <ImagePlus className="w-5 h-5 text-slate-400 mb-1" />
                    {coverImagePreview ? (
                      <p className="text-[9px] text-slate-600 dark:text-slate-400">Click to change</p>
                    ) : (
                      <>
                        <p className="text-[9px] text-slate-600 dark:text-slate-400">Click to upload image</p>
                        <p className="text-[8px] text-slate-500">GIF, SVG, JPEG, PNG (max 2MB)</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".gif,.svg,.jpg,.jpeg,.png,image/gif,image/svg+xml,image/jpeg,image/png"
                    onChange={handleCoverImageChange}
                  />
                </label>
              </div>
              {coverImagePreview && (
                <div className="flex items-center justify-center mt-1">
                  <img
                    src={coverImagePreview}
                    alt="Cover preview"
                    className="max-h-20 max-w-20 rounded-md object-cover border border-slate-200 dark:border-slate-700"
                  />
                </div>
              )}
            </div>

            {/* Opponent Search - Direct Only */}
            {createFormData.challengeType === 'direct' && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                  <Input
                    placeholder="Search opponent..."
                    className="rounded-md border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus:ring-1 focus:ring-[#ccff00] h-7 pl-7 text-xs"
                    value={opponentSearchTerm}
                    onChange={(e) => setOpponentSearchTerm(e.target.value)}
                  />
                </div>
                {opponentSearchTerm && filteredUsers.length > 0 && (
                  <div className="mt-1 max-h-[100px] overflow-y-auto rounded-md border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg divide-y divide-slate-50 dark:divide-slate-800">
                    {filteredUsers.map((u: any) => (
                      <button
                        key={u.id}
                        className={cn(
                          "w-full flex items-center gap-1.5 p-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-[10px]",
                          preSelectedUser?.id === u.id && "bg-[#ccff00]/10 dark:bg-[#ccff00]/5"
                        )}
                        onClick={() => {
                          setPreSelectedUser(u);
                          setOpponentSearchTerm("");
                        }}
                      >
                        <UserAvatar userId={u.id} username={u.username} className="h-5 w-5" />
                        <div className="flex flex-col flex-1 min-w-0">
                          <p className="font-bold text-slate-900 dark:text-slate-100 truncate">@{u.username}</p>
                          <p className="text-[8px] text-slate-500 truncate">
                            {u.primaryWalletAddress ? `${u.primaryWalletAddress.slice(0, 6)}...${u.primaryWalletAddress.slice(-4)}` : 'No wallet'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {preSelectedUser && (
                  <div className="mt-1 flex items-center gap-1.5 p-1.5 rounded-md bg-[#7440FF]/10 dark:bg-[#ccff00]/5 border border-[#ccff00]/20 text-[10px]">
                    <UserAvatar userId={preSelectedUser.id} username={preSelectedUser.username} className="h-4 w-4" />
                    <p className="flex-1 font-semibold truncate">@{preSelectedUser.username}</p>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 text-slate-400 hover:text-red-500"
                      onClick={() => setPreSelectedUser(null)}
                    >
                      <Zap className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>


          <Button
            className="w-full h-8 rounded-md bg-[#7440FF] text-white font-bold text-xs hover:bg-[#7440FF] shadow-lg shadow-[#ccff00]/20 disabled:opacity-50 transition-all active:scale-[0.98]"
            disabled={createChallengeMutation.isPending || !createFormData.title || createFormData.amount <= 0 || (createFormData.challengeType === 'direct' && !preSelectedUser)}
            onClick={() => {
              if (!createFormData.amount || createFormData.amount <= 0) {
                toast({
                  title: 'Invalid Amount',
                  description: `Please enter a valid amount greater than 0`,
                  variant: 'destructive',
                });
                return;
              }
              createChallengeMutation.mutate(createFormData);
            }}
          >
            {createChallengeMutation.isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      </DialogContent>
        </Dialog>

        {/* Search results and other content below the feed */}
        {searchTerm && (
          <div className="mt-8 space-y-6">
             {/* Search content... */}
          </div>
        )}
      </div>

      {/* Challenge Chat Dialog */}
      {showChat && selectedChallenge && (
        <Dialog open={showChat} onOpenChange={setShowChat}>
          <DialogContent className="sm:max-w-4xl max-h-[80vh] p-0">
            <ChallengeChat
              challenge={selectedChallenge}
              onClose={() => setShowChat(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Join Challenge Modal (for admin-created betting challenges) */}
      {showJoinModal && selectedChallenge && (
        <JoinChallengeModal
          isOpen={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          challenge={selectedChallenge}
          userBalance={balance && typeof balance === "object" ? (balance as any).balance : (typeof balance === 'number' ? balance : 0)}
        />
      )}

      <MobileNavigation />
    </div>
  );
}
