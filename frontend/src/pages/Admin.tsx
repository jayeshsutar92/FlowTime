import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Users, Shield, Trash2, AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";

interface AdminUser {
  id: number;
  username: string;
  email: string;
  date_joined: string;
  is_staff: boolean;
}

export default function Admin() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/timer");
      return;
    }
    fetchData();
  }, [isAdmin]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, countRes] = await Promise.all([
        api.get("/admin/users/"),
        api.get("/admin/users/count/"),
      ]);
      setUsers(usersRes.data.data);
      setTotalCount(countRes.data.data.count);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to fetch users.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await api.delete(`/admin/users/${deleteTarget.id}/`);
      setDeleteTarget(null);
      await fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to delete user.";
      setError(msg);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  if (!isAdmin) return null;

  return (
    <main className="pt-24 pb-20 px-4 md:px-margin-desktop max-w-container-max mx-auto">
      <header className="mb-12">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-primary" />
          <h1 className="font-headline-lg text-headline-lg md:text-display-xl md:font-display-xl text-on-surface text-center tracking-tight">
            Admin Panel
          </h1>
        </div>
        <p className="text-on-surface-variant text-center max-w-2xl mx-auto">
          Manage users and monitor platform activity.
        </p>
      </header>

      {error && (
        <div className="bg-error/10 border border-error/20 text-error p-4 rounded-xl mb-8 text-sm flex items-center gap-3 max-w-2xl mx-auto">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter mb-gutter">
        <div className="glass-card rounded-xl p-8 transition-all hover:border-primary/30">
          <div className="flex flex-col h-full">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-4 tracking-wider">
              Total Users
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-display-xl text-[64px] font-bold leading-none tracking-tighter text-on-surface">
                {loading ? "—" : totalCount}
              </span>
              <span className="text-on-surface-variant font-medium">registered</span>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-8 transition-all hover:border-primary/30">
          <div className="flex flex-col h-full">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-4 tracking-wider">
              Admin Users
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-display-xl text-[64px] font-bold leading-none tracking-tighter text-on-surface">
                {loading ? "—" : users.filter((u) => u.is_staff).length}
              </span>
              <span className="text-on-surface-variant font-medium">staff</span>
            </div>
          </div>
        </div>
      </div>

      {/* User List */}
      <div className="glass-card rounded-xl p-8">
        <div className="flex items-center gap-2 mb-8 border-b border-white/5 pb-4">
          <Users className="text-primary w-6 h-6" />
          <h2 className="font-headline-lg text-headline-lg-mobile text-on-surface tracking-tight">
            All Users
          </h2>
          <span className="ml-auto text-on-surface-variant text-sm font-label-sm">
            {users.length} {users.length === 1 ? "user" : "users"}
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="animate-spin h-8 w-8 border-2 border-white/20 border-t-primary rounded-full"></span>
          </div>
        ) : users.length === 0 ? (
          <p className="text-on-surface-variant text-center py-12">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-widest py-3 px-4">
                    User
                  </th>
                  <th className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-widest py-3 px-4 hidden md:table-cell">
                    Email
                  </th>
                  <th className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-widest py-3 px-4 hidden md:table-cell">
                    Joined
                  </th>
                  <th className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-widest py-3 px-4">
                    Role
                  </th>
                  <th className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-widest py-3 px-4 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-sm font-bold text-primary border border-white/5">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-on-surface font-medium text-sm">{user.username}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-on-surface-variant text-sm hidden md:table-cell">
                      {user.email || "—"}
                    </td>
                    <td className="py-4 px-4 text-on-surface-variant text-sm hidden md:table-cell font-label-sm">
                      {formatDate(user.date_joined)}
                    </td>
                    <td className="py-4 px-4">
                      {user.is_staff ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-primary/15 text-primary border border-primary/20">
                          <Shield className="w-3 h-3" />
                          Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-white/5 text-on-surface-variant border border-white/5">
                          User
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      {!user.is_staff && (
                        <button
                          onClick={() => setDeleteTarget(user)}
                          className="text-on-surface-variant hover:text-error transition-colors p-2 rounded-lg hover:bg-error/10"
                          title={`Delete ${user.username}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteTarget(null)}
          ></div>
          <div className="glass-card rounded-2xl p-8 max-w-md w-full relative z-10 border border-white/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-error" />
              </div>
              <h3 className="font-headline-lg text-lg text-on-surface font-semibold">
                Delete User
              </h3>
            </div>
            <p className="text-on-surface-variant text-sm mb-8 leading-relaxed">
              Are you sure you want to delete{" "}
              <span className="text-on-surface font-semibold">{deleteTarget.username}</span>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-on-surface-variant hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-error hover:bg-red-500 transition-colors flex items-center gap-2 shadow-lg shadow-error/20"
              >
                {deleting ? (
                  <span className="animate-spin h-4 w-4 border-2 border-white/20 border-t-white rounded-full"></span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
