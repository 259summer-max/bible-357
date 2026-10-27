"use client";

import React, { useState, useEffect } from "react";
import { Play, CheckCircle2, Circle, BookOpen, ExternalLink, AlertCircle, User, LogOut, Loader2 } from "lucide-react";

const SHEET_ID = "1ys08Lb0ENd5U_SuAsZvLUnw3Y-JA89Z3JV38wWnrTs8";
// 👇 일반 창에서 발급받은 Apps Script 웹앱 URL을 여기에 넣어주시면 Members 시트에 실시간 기록됩니다!
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbynjFJlU0fuZfo7S0EUDUkOg8WblcOcJQ_sLnkpX0Z1lXKip0uB_4ofyHnYrIdG_n582w/exec";

interface VideoItem {
  day: number;
  ot: string;
  nt: string;
  psalm: string;
  link: string;
}

interface UserInfo {
  name: string;
  pin: string;
}

function extractYouTubeId(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export default function BibleReadingApp() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 성도 로그인 정보 상태
  const [user, setUser] = useState<UserInfo | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [showLoginModal, setShowLoginModal] = useState(false);

  const [completedDays, setCompletedDays] = useState<number[]>([]);
  const [lastReadDay, setLastReadDay] = useState<number>(0);
  const [activeVideoDay, setActiveVideoDay] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [logoLoaded, setLogoLoaded] = useState(false);

  // 1. 초기 데이터 및 저장된 로그인 정보 불러오기
  useEffect(() => {
    const savedUser = localStorage.getItem("bible357_user");
    const savedCompleted = localStorage.getItem("bible357_completed");
    const savedLastDay = localStorage.getItem("bible357_last_day");

    if (savedCompleted) setCompletedDays(JSON.parse(savedCompleted));
    if (savedLastDay) setLastReadDay(Number(savedLastDay));

    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      syncLoginWithSheet(parsedUser.name, parsedUser.pin, savedCompleted ? JSON.parse(savedCompleted) : []);
    } else {
      setShowLoginModal(true);
    }

    async function fetchSheetData() {
      try {
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Videos`;
        const res = await fetch(url);
        const text = await res.text();

        const startIdx = text.indexOf("{");
        const endIdx = text.lastIndexOf("}");
        if (startIdx === -1 || endIdx === -1) throw new Error("시트 접근 권한 오류");

        const json = JSON.parse(text.substring(startIdx, endIdx + 1));
        const parsedVideos: VideoItem[] = json.table.rows
          .map((row: any) => {
            const c = row.c;
            if (!c || !c[0] || c[0].v === null || isNaN(Number(c[0].v))) return null;
            return {
              day: Number(c[0]?.v),
              ot: c[1]?.v ? String(c[1].v).trim() : "",
              nt: c[2]?.v ? String(c[2].v).trim() : "",
              psalm: c[3]?.v ? String(c[3].v).trim() : "",
              link: c[4]?.v ? String(c[4].v).trim() : "",
            };
          })
          .filter(Boolean);

        setVideos(parsedVideos);
      } catch (err) {
        console.error("시트 불러오기 오류:", err);
        setErrorMsg("구글 시트 공유 설정이 '링크가 있는 모든 사용자'인지 확인해 주세요.");
      } finally {
        setLoading(false);
      }
    }
    fetchSheetData();
  }, []);

  // 2. 구글 시트(Members 탭)에서 내 진도 불러오기 & 합치기
  const syncLoginWithSheet = async (name: string, pin: string, localDays: number[]) => {
    if (!GOOGLE_SCRIPT_URL.startsWith("http")) return;
    setSyncing(true);
    try {
      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({ action: "login", name, pin }),
      });
      const data = await res.json();
      if (data.status === "success" && Array.isArray(data.completedDays)) {
        // 기기에 저장된 기록과 시트에 저장된 기록을 합쳐서 보존
        const merged = Array.from(new Set([...localDays, ...data.completedDays])).sort((a, b) => a - b);
        setCompletedDays(merged);
        localStorage.setItem("bible357_completed", JSON.stringify(merged));
        if (merged.length > 0 && lastReadDay === 0) {
          const maxDay = merged[merged.length - 1];
          setLastReadDay(maxDay);
          localStorage.setItem("bible357_last_day", String(maxDay));
        }
      }
    } catch (e) {
      console.error("시트 로그인 동기화 실패:", e);
    } finally {
      setSyncing(false);
    }
  };

  // 3. 구글 시트(Members 탭)에 변경된 진도 저장하기
  const saveProgressToSheet = async (updatedDays: number[]) => {
    if (!user || !GOOGLE_SCRIPT_URL.startsWith("http")) return;
    setSyncing(true);
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "update",
          name: user.name,
          pin: user.pin,
          completedDays: updatedDays,
          totalDays: videos.length || 357,
        }),
      });
    } catch (e) {
      console.error("시트 진도 저장 실패:", e);
    } finally {
      setSyncing(false);
    }
  };

  // 4. 로그인 버튼 처리
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nameInput.trim();
    const cleanPin = pinInput.trim();
    if (!cleanName || cleanPin.length < 4) {
      alert("성함과 휴대전화 뒷자리 4자리를 정확히 입력해 주세요.");
      return;
    }
    const newUser = { name: cleanName, pin: cleanPin };
    setUser(newUser);
    localStorage.setItem("bible357_user", JSON.stringify(newUser));
    setShowLoginModal(false);
    await syncLoginWithSheet(cleanName, cleanPin, completedDays);
  };

  const handleLogout = () => {
    if (!confirm("다른 분으로 변경하시겠습니까?")) return;
    localStorage.removeItem("bible357_user");
    setUser(null);
    setNameInput("");
    setPinInput("");
    setShowLoginModal(true);
  };

  // 5. 말씀 클릭 시 자동 완료 & 시트 저장
  const handleSelectAndMarkRead = (item: VideoItem, openExternal = false) => {
    const updatedCompleted = completedDays.includes(item.day)
      ? completedDays
      : [...completedDays, item.day].sort((a, b) => a - b);

    setCompletedDays(updatedCompleted);
    setLastReadDay(item.day);

    localStorage.setItem("bible357_completed", JSON.stringify(updatedCompleted));
    localStorage.setItem("bible357_last_day", String(item.day));

    saveProgressToSheet(updatedCompleted);

    if (openExternal) {
      window.open(item.link, "_blank");
    } else {
      setActiveVideoDay(activeVideoDay === item.day ? null : item.day);
    }
  };

  const toggleManualCheck = (day: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = completedDays.includes(day)
      ? completedDays.filter((d) => d !== day)
      : [...completedDays, day].sort((a, b) => a - b);

    setCompletedDays(updated);
    localStorage.setItem("bible357_completed", JSON.stringify(updated));
    saveProgressToSheet(updated);
  };

  const recommendedVideo =
    videos.find((v) => v.day === lastReadDay + 1 && !completedDays.includes(v.day)) ||
    videos.find((v) => !completedDays.includes(v.day)) ||
    videos[videos.length - 1];

  const totalCount = videos.length || 357;
  const progressPercent = Math.min(100, Math.round((completedDays.length / totalCount) * 1000) / 10);

  const filteredVideos = videos.filter((v) => {
    if (filter === "unread") return !completedDays.includes(v.day);
    if (filter === "read") return completedDays.includes(v.day);
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-800 pb-20 font-sans">
      {/* 이름 + 뒷자리 4자리 입력 모달 */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl">
            <div className="w-12 h-12 bg-indigo-50 text-[#00254D] rounded-2xl flex items-center justify-center mb-4">
              <User className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">성도 확인</h2>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              이름과 휴대전화 뒷번호 4자리를 입력하시면 개인별 성경읽기 진도가 자동 저장됩니다.
            </p>
            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">이름</label>
                <input
                  type="text"
                  placeholder="예: 가브리엘"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#00254D]"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">휴대전화 뒷번호 4자리</label>
                <input
                  type="tel"
                  maxLength={4}
                  placeholder="예: 1004"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#00254D]"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#00254D] text-white font-bold py-3.5 rounded-xl text-sm mt-2 active:scale-98 transition"
              >
                말씀 읽기 시작하기
              </button>
              {user && (
                <button
                  type="button"
                  onClick={() => setShowLoginModal(false)}
                  className="w-full text-slate-400 text-xs py-2"
                >
                  닫기
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      <header className="bg-[#00254D] text-white pt-6 pb-8 px-5 rounded-b-3xl shadow-md">
        <div className="max-w-md mx-auto">
          {/* 상단 성도 이름 표시 바 */}
          <div className="flex items-center justify-between bg-white/10 px-3.5 py-2 rounded-xl mb-4 text-xs">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-amber-300" />
              {user ? (
                <span>
                  <b className="text-amber-300">{user.name}</b> 님 ({user.pin})
                </span>
              ) : (
                <span>성도 정보를 입력해 주세요</span>
              )}
              {syncing && <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-200 ml-1" />}
            </div>
            <button
              onClick={() => (user ? handleLogout() : setShowLoginModal(true))}
              className="text-sky-200 hover:text-white flex items-center gap-1 font-medium"
            >
              {user ? (
                <>
                  변경 <LogOut className="w-3.5 h-3.5" />
                </>
              ) : (
                "입력하기"
              )}
            </button>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center overflow-hidden relative">
                <BookOpen className={`w-6 h-6 text-sky-200 ${logoLoaded ? "hidden" : "block"}`} />
                <img
                  src="/logo.png"
                  alt="교회 로고"
                  className={`w-full h-full object-contain p-1 ${logoLoaded ? "block" : "hidden"}`}
                  onLoad={() => setLogoLoaded(true)}
                  onError={() => setLogoLoaded(false)}
                />
              </div>
              <div>
                <p className="text-xs text-sky-200 font-medium">매일 20분 말씀과 동행하는</p>
                <h1 className="text-xl font-bold tracking-tight">153 성경읽기</h1>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-sky-200 block">나의 통독 진도율</span>
              <span className="text-2xl font-extrabold text-amber-300">{progressPercent}%</span>
            </div>
          </div>

          <div className="w-full bg-white/15 h-3 rounded-full overflow-hidden">
            <div
              className="bg-amber-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-sky-100 mt-2">
            <span>완료: {completedDays.length}일 / 전체 {totalCount}일</span>
            {lastReadDay > 0 && <span>최근 읽은 순번: {lastReadDay}일차</span>}
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 -mt-4 space-y-5">
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-xs flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
            <div>
              <p className="font-bold mb-1">데이터를 불러오지 못했습니다</p>
              <p>{errorMsg}</p>
            </div>
          </div>
        )}

        {!loading && recommendedVideo && (
          <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold px-2.5 py-1 bg-indigo-50 text-[#00254D] rounded-full">
                오늘 읽을 차례예요
              </span>
              <span className="text-sm font-bold text-slate-400">Day {recommendedVideo.day}</span>
            </div>

            <div className="flex flex-wrap gap-1.5 my-3">
              {recommendedVideo.ot && (
                <span className="px-2.5 py-1 bg-amber-50 text-amber-800 text-xs font-semibold rounded-lg">
                  구약: {recommendedVideo.ot}
                </span>
              )}
              {recommendedVideo.nt && (
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-lg">
                  신약: {recommendedVideo.nt}
                </span>
              )}
              {recommendedVideo.psalm && (
                <span className="px-2.5 py-1 bg-purple-50 text-purple-800 text-xs font-semibold rounded-lg">
                  시편: {recommendedVideo.psalm}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                onClick={() => handleSelectAndMarkRead(recommendedVideo, false)}
                className="flex items-center justify-center gap-2 bg-[#00254D] text-white py-3 px-4 rounded-xl font-bold text-sm active:scale-95 transition"
              >
                <Play className="w-4 h-4 fill-white" />
                여기서 바로 재생
              </button>
              <button
                onClick={() => handleSelectAndMarkRead(recommendedVideo, true)}
                className="flex items-center justify-center gap-1.5 bg-slate-100 text-slate-700 py-3 px-4 rounded-xl font-bold text-sm active:scale-95 transition"
              >
                <ExternalLink className="w-4 h-4" />
                유튜브 앱으로 열기
              </button>
            </div>
            <p className="text-[11px] text-slate-400 text-center mt-2.5">
              * 버튼을 누르면 자동으로 <b>{recommendedVideo.day}일차 읽음 완료</b>로 저장됩니다.
            </p>
          </section>
        )}

        <div className="flex bg-slate-200/70 p-1 rounded-xl text-sm font-semibold">
          <button
            onClick={() => setFilter("all")}
            className={`flex-1 py-2 rounded-lg transition ${
              filter === "all" ? "bg-white text-[#00254D] shadow-sm" : "text-slate-500"
            }`}
          >
            전체 ({videos.length})
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`flex-1 py-2 rounded-lg transition ${
              filter === "unread" ? "bg-white text-[#00254D] shadow-sm" : "text-slate-500"
            }`}
          >
            안 읽은 말씀 ({videos.length - completedDays.length})
          </button>
          <button
            onClick={() => setFilter("read")}
            className={`flex-1 py-2 rounded-lg transition ${
              filter === "read" ? "bg-white text-[#00254D] shadow-sm" : "text-slate-500"
            }`}
          >
            읽음 완료 ({completedDays.length})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            말씀 목록을 불러오는 중입니다...
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredVideos.map((item) => {
              const isDone = completedDays.includes(item.day);
              const isRecent = lastReadDay === item.day;
              const isPlaying = activeVideoDay === item.day;
              const videoId = extractYouTubeId(item.link);

              return (
                <div
                  key={item.day}
                  className={`bg-white rounded-2xl border transition overflow-hidden ${
                    isRecent
                      ? "border-[#00254D] ring-1 ring-[#00254D]/20"
                      : isDone
                      ? "border-slate-100 bg-slate-50/70"
                      : "border-slate-100"
                  }`}
                >
                  <div
                    onClick={() => handleSelectAndMarkRead(item, false)}
                    className="p-4 flex items-center justify-between gap-3 cursor-pointer active:bg-slate-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className={`text-sm font-extrabold ${
                            isDone ? "text-slate-400" : "text-[#00254D]"
                          }`}
                        >
                          {item.day}일차
                        </span>
                        {isRecent && (
                          <span className="text-[11px] font-bold px-2 py-0.5 bg-indigo-100 text-[#00254D] rounded-md">
                            최근 읽음
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {item.ot && (
                          <span className="px-2 py-0.5 bg-amber-50/90 text-amber-900 text-xs font-medium rounded-md">
                            구약: {item.ot}
                          </span>
                        )}
                        {item.nt && (
                          <span className="px-2 py-0.5 bg-emerald-50/90 text-emerald-900 text-xs font-medium rounded-md">
                            신약: {item.nt}
                          </span>
                        )}
                        {item.psalm && (
                          <span className="px-2 py-0.5 bg-purple-50/90 text-purple-900 text-xs font-medium rounded-md">
                            시편: {item.psalm}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => toggleManualCheck(item.day, e)}
                      className="p-1.5 rounded-full hover:bg-slate-100 transition shrink-0"
                      title="읽음 표시 전환"
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-7 h-7 text-emerald-500 fill-emerald-50" />
                      ) : (
                        <Circle className="w-7 h-7 text-slate-300" />
                      )}
                    </button>
                  </div>

                  {isPlaying && (
                    <div className="bg-slate-900 p-3 border-t border-slate-100">
                      {videoId ? (
                        <div className="relative w-full pt-[56.25%] rounded-xl overflow-hidden bg-black">
                          <iframe
                            className="absolute top-0 left-0 w-full h-full"
                            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
                            title={`${item.day}일차 성경읽기`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ) : (
                        <div className="text-center py-6 text-white text-sm">
                          영상을 바로 재생할 수 없습니다. 아래 버튼을 눌러주세요.
                        </div>
                      )}
                      <div className="flex justify-between items-center mt-2.5 px-1">
                        <span className="text-xs text-emerald-400 font-medium">
                          ✓ {item.day}일차 읽음으로 자동 체크되었습니다
                        </span>
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-sky-300 underline flex items-center gap-1"
                        >
                          유튜브 앱에서 크게 보기 <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}