export type ReservableSchedStatus = "OPEN" | "ON_GOING" | "FULLY_BOOKED" | "CLOSED";

export function isSchedStatusReservable(status: ReservableSchedStatus) {
  return status === "OPEN" || status === "ON_GOING";
}
