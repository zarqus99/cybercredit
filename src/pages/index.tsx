import type { NextPage } from "next";
import styles from "./index.module.css";
import { WalletConnectButton } from "@/components";
import { useEffect, useState } from "react";

import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import LoadingButton from "@mui/lab/LoadingButton";
import TextField from "@mui/material/TextField";

import { followListInfoQuery, searchUserInfoQuery } from "@/utils/query";
import { FollowListInfoResp, SearchUserInfoResp, Network } from "@/utils/types";
import { formatAddress, removeDuplicate, isValidAddr } from "@/utils/helper";
import { useWeb3 } from "@/context/web3Context";

const NAME_SPACE = "CyberConnect";
const NETWORK = Network.ETH;
const FIRST = 10; // The number of users in followings/followers list for each fetch

const Home: NextPage = () => {
  const { address, cyberConnect } = useWeb3();
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarText, setSnackbarText] = useState<string>("");

  const [searchInput, setSearchInput] = useState<string>("");
  const [searchAddrInfo, setSearchAddrInfo] =
    useState<SearchUserInfoResp | null>(null);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);

  const [followListInfo, setFollowListInfo] =
    useState<FollowListInfoResp | null>(null);
  const [followLoading, setFollowLoading] = useState<boolean>(false);

  const fetchSearchAddrInfo = async (toAddr: string) => {
    const resp = await searchUserInfoQuery({
      fromAddr: address,
      toAddr,
      network: NETWORK,
    });
    if (resp) {
      setSearchAddrInfo(resp);
    }
  };

  const handleFollow = async () => {
    if (!cyberConnect || !searchAddrInfo) {
      return;
    }

    try {
      setFollowLoading(true);

      // Execute connect if the current user is not following the search addrress.
      if (!searchAddrInfo.connections[0].followStatus.isFollowing) {
        await cyberConnect.connect(searchInput);

        // Overwrite the local status of isFollowing
        setSearchAddrInfo((prev) => {
          return !!prev
            ? {
                ...prev,
                connections: [
                  {
                    followStatus: {
                      ...prev.connections[0].followStatus,
                      isFollowing: true,
                    },
                  },
                ],
              }
            : prev;
        });

        // Add the new following to the current user followings list
        setFollowListInfo((prev) => {
          return !!prev
            ? {
                ...prev,
                followingCount: prev.followingCount + 1,
                followings: {
                  ...prev.followings,
                  list: removeDuplicate(
                    prev.followings.list.concat([searchAddrInfo.identity])
                  ),
                },
              }
            : prev;
        });

        setSnackbarText("Follow Success!");
      } else {
        await cyberConnect.disconnect(searchInput);

        setSearchAddrInfo((prev) => {
          return !!prev
            ? {
                ...prev,
                connections: [
                  {
                    followStatus: {
                      ...prev.connections[0].followStatus,
                      isFollowing: false,
                    },
                  },
                ],
              }
            : prev;
        });

        setFollowListInfo((prev) => {
          return !!prev
            ? {
                ...prev,
                followingCount: prev.followingCount - 1,
                followings: {
                  ...prev.followings,
                  list: prev.followings.list.filter((user) => {
                    return user.address !== searchAddrInfo.identity.address;
                  }),
                },
              }
            : prev;
        });

        setSnackbarText("Unfollow Success!");
      }

      setSnackbarOpen(true);
    } catch (e) {
      console.error(e);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleInputChange = async (value: string) => {
    setSearchInput(value);

    if (isValidAddr(value) && address && address !== searchInput) {
      setSearchLoading(true);
      await fetchSearchAddrInfo(value);
    }
    setSearchLoading(false);
  };

  // Get the current user followings and followers list
  const initFollowListInfo = async () => {
    if (!address) {
      return;
    }

    const resp = await followListInfoQuery({
      address,
      namespace: NAME_SPACE,
      network: NETWORK,
      followingFirst: FIRST,
      followerFirst: FIRST,
    });
    if (resp) {
      setFollowListInfo(resp);
    }
  };

  const fetchMore = async (type: "followings" | "followers") => {
    if (!address || !followListInfo) {
      return;
    }

    const params =
      type === "followers"
        ? {
            address,
            namespace: NAME_SPACE,
            network: NETWORK,
            followerFirst: FIRST,
            followerAfter: followListInfo.followers.pageInfo.endCursor,
          }
        : {
            address,
            namespace: NAME_SPACE,
            network: NETWORK,
            followingFirst: FIRST,
            followingAfter: followListInfo.followings.pageInfo.endCursor,
          };

    const resp = await followListInfoQuery(params);
    if (resp) {
      type === "followers"
        ? setFollowListInfo({
            ...followListInfo,
            followers: {
              pageInfo: resp.followers.pageInfo,
              list: removeDuplicate(
                followListInfo.followers.list.concat(resp.followers.list)
              ),
            },
          })
        : setFollowListInfo({
            ...followListInfo,
            followings: {
              pageInfo: resp.followings.pageInfo,
              list: removeDuplicate(
                followListInfo.followings.list.concat(resp.followings.list)
              ),
            },
          });
    }
  };

  useEffect(() => {
    initFollowListInfo();
  }, [address]);

  return (
    <div className={styles.container}>
      <div className={styles.logo}>
        <img
          src="/cyberconnect-logo.jpg"
          alt="CyberConnect Logo"
          width="100%"
          height="100%"
        />
      </div>
      <div className={styles.discription}>
        <p>
          This app displays the current user's wallet credit score after connecting their wallet.
        </p>
        <p>Try it yourself!</p>
      </div>
      <WalletConnectButton />
      {followListInfo && (
            <div className={styles.subtitle}>
              Your cybercredit score is: <strong>{followListInfo.followerCount + followListInfo.followingCount}</strong>
            </div>
      )}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
      >
        <MuiAlert
          onClose={() => setSnackbarOpen(false)}
          severity="success"
          sx={{ width: "100%" }}
        >
          {snackbarText}
        </MuiAlert>
      </Snackbar>
    </div>
  );
};

export default Home;
