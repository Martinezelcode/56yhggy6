import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get currency symbol from token address
 */
export function getCurrencySymbol(tokenAddress?: string): string {
  if (!tokenAddress) return "$"; // fallback

  // Known token addresses
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b3566dA8860";
  const USDC_TEST_ADDRESS = "0x1c7d4b196cb0c7b01d743fbc6116a792bf68cf5d";

  if (tokenAddress.toLowerCase() === USDC_ADDRESS.toLowerCase() ||
      tokenAddress.toLowerCase() === USDC_TEST_ADDRESS.toLowerCase()) {
    return "USDC";
  }

  // For other tokens, return the address or a generic symbol
  return "TOKEN";
}

/**
 * Format user display name for UI
 * Prioritizes: username > firstName/lastName > wallet address > fallback
 */
export function formatUserDisplayName(user?: {
  id?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}): string {
  // Priority 1: Username (from email/telegram registration)
  if (user?.username && !user.username.startsWith('did:privy:')) {
    return user.username;
  }

  // Priority 2: First name + last name
  if (user?.firstName) {
    if (user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.firstName;
  }

  // Priority 3: Extract readable wallet address from Privy ID
  if (user?.id?.startsWith('did:privy:')) {
    // Extract the wallet address part (usually the last segment)
    const parts = user.id.split(':');
    if (parts.length >= 3) {
      const walletId = parts[2];
      // If it's a wallet address (starts with 0x), format it
      if (walletId.startsWith('0x') && walletId.length > 10) {
        return `${walletId.slice(0, 6)}...${walletId.slice(-4)}`;
      }
      // Otherwise return a truncated version
      return walletId.length > 8 ? `${walletId.slice(0, 8)}...` : walletId;
    }
  }

  // Priority 4: Raw user ID if it's not a Privy ID
  if (user?.id && !user.id.startsWith('did:privy:')) {
    if (user.id.startsWith('0x') && user.id.length > 10) {
      return `${user.id.slice(0, 6)}...${user.id.slice(-4)}`;
    }
    return user.id.length > 8 ? `${user.id.slice(0, 8)}...` : user.id;
  }

  // Fallback
  return "Anonymous";
}
