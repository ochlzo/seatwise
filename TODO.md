1. Edit Save to Templates function to check if there are shows related to the seatmap already. If there are, show a modal dialog to the user that shows an error message that they can't save the seatmap to templates if there are shows using it already. Allow them to have an option to save as new template.✅

2. Fix bug on editing shows in ShowDetailForm.tsx component. When editing the seat categories section, when the seat category name is not changed, and the user changes the price or the color, it doesn't save the changes, it uses the old price or color. ✅

Also check in CreateShowForm.tsx component if there are similar issues. ✅

3. Fix bug again on ShowDetailForm.tsx component. When making changes on the Seat Categories section, the UI is not displaying the capsule component under the scheds correctly. ✅

4. Make sure URL params are secure - prevent sql injection

5. Prevent DDOS in login.

6. Remove seatmap status and enable/disable features in template tables

7. Calendar page

8. Dashboard Page

9. Users page (admin)

10. Admin access page

11. Add a flag on edit in seatmappreview on create and update for easy identification all seats assigned.
