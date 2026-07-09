import 'package:intl/intl.dart';

class DateFormatter {
  /// Format date as "dd/MM/yyyy" (Vietnamese style)
  static String formatDate(DateTime date) {
    return DateFormat('dd/MM/yyyy').format(date);
  }

  /// Format date as "dd MMM, yyyy" (e.g., "15 Thg 1, 2024")
  static String formatDateLong(DateTime date) {
    return DateFormat('dd MMM, yyyy', 'vi').format(date);
  }

  /// Format date and time as "dd/MM/yyyy HH:mm"
  static String formatDateTime(DateTime date) {
    return DateFormat('dd/MM/yyyy HH:mm').format(date);
  }

  /// Format as relative time (e.g., "2 giờ trước", "3 ngày trước")
  static String formatRelative(DateTime date) {
    final now = DateTime.now();
    final difference = now.difference(date);

    if (difference.inDays > 7) {
      return formatDate(date);
    } else if (difference.inDays > 0) {
      return '${difference.inDays} ngày trước';
    } else if (difference.inHours > 0) {
      return '${difference.inHours} giờ trước';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes} phút trước';
    } else {
      return 'Vừa xong';
    }
  }
}
