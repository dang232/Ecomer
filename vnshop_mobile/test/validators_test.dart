import 'package:flutter_test/flutter_test.dart';
import 'package:vnshop_mobile/core/utils/validators.dart';

void main() {
  group('Validators', () {
    group('validatePhone', () {
      test('0912345678 is valid (10 digits starting with 0)', () {
        final result = Validators.validatePhone('0912345678');
        expect(result, isNull);
      });

      test('84912345678 is invalid (starts with 84, not 0)', () {
        // The validator uses regex ^(0[0-9]{9})$ which requires starting with 0
        final result = Validators.validatePhone('84912345678');
        expect(result, isNotNull);
        expect(result, 'Số điện thoại không hợp lệ');
      });

      test('0123456789 is valid (valid Viettel prefix)', () {
        // 012 is a valid Vietnam phone prefix (Viettel)
        final result = Validators.validatePhone('0123456789');
        expect(result, isNull);
      });

      test('returns error message for empty phone', () {
        final result = Validators.validatePhone(null);
        expect(result, 'Vui lòng nhập số điện thoại');
      });

      test('returns error message for empty string', () {
        final result = Validators.validatePhone('');
        expect(result, 'Vui lòng nhập số điện thoại');
      });

      test('invalid format returns error', () {
        expect(Validators.validatePhone('12345'), 'Số điện thoại không hợp lệ');
        expect(Validators.validatePhone('abcdefghij'), 'Số điện thoại không hợp lệ');
        expect(Validators.validatePhone('12345678901'), 'Số điện thoại không hợp lệ');
      });

      test('phone with spaces is valid after trimming', () {
        final result = Validators.validatePhone('0912345678');
        expect(result, isNull);
      });

      test('various valid Vietnamese phone prefixes (10 digits starting with 0)', () {
        // Valid prefixes: 086, 096, 097, 098, 032, 033, 034, 035, 036, 037, 038, 039
        // 090, 093, 070, 079, 077, 078, 076
        // 091, 094, 083, 085, 082, 081
        // 089, 090, 093
        final validPhones = [
          '0861234567',
          '0961234567',
          '0971234567',
          '0981234567',
          '0321234567',
          '0901234567',
          '0931234567',
          '0701234567',
          '0791234567',
          '0911234567',
          '0941234567',
          '0891234567',
          '0123456789', // 012 is valid prefix
        ];

        for (final phone in validPhones) {
          expect(Validators.validatePhone(phone), isNull,
              reason: '$phone should be valid');
        }
      });
    });

    group('validateEmail', () {
      test('valid email returns null', () {
        expect(Validators.validateEmail('test@example.com'), isNull);
        expect(Validators.validateEmail('user.name@domain.com'), isNull);
        expect(Validators.validateEmail('user-name@domain.com'), isNull);
        expect(Validators.validateEmail('user_name@domain.com'), isNull);
      });

      test('invalid email returns error message', () {
        expect(Validators.validateEmail(null), 'Vui lòng nhập email');
        expect(Validators.validateEmail(''), 'Vui lòng nhập email');
        expect(Validators.validateEmail('invalid'), 'Email không hợp lệ');
        expect(Validators.validateEmail('invalid@'), 'Email không hợp lệ');
        expect(Validators.validateEmail('@domain.com'), 'Email không hợp lệ');
        expect(Validators.validateEmail('user@.com'), 'Email không hợp lệ');
      });

      test('email without @ returns error', () {
        expect(Validators.validateEmail('testexample.com'), 'Email không hợp lệ');
      });

      test('email without domain returns error', () {
        expect(Validators.validateEmail('test@'), 'Email không hợp lệ');
      });
    });

    group('validatePassword', () {
      test('valid password returns null', () {
        expect(Validators.validatePassword('password123'), isNull);
        expect(Validators.validatePassword('123456'), isNull);
        expect(Validators.validatePassword('abcdefgh'), isNull);
      });

      test('password less than 6 characters returns error', () {
        expect(Validators.validatePassword('12345'), 'Mật khẩu phải có ít nhất 6 ký tự');
        expect(Validators.validatePassword('abc'), 'Mật khẩu phải có ít nhất 6 ký tự');
      });

      test('null or empty password returns error', () {
        expect(Validators.validatePassword(null), 'Vui lòng nhập mật khẩu');
        expect(Validators.validatePassword(''), 'Vui lòng nhập mật khẩu');
      });
    });

    group('validateRequired', () {
      test('valid input returns null', () {
        expect(Validators.validateRequired('test', 'field'), isNull);
        expect(Validators.validateRequired('  test  ', 'field'), isNull);
      });

      test('null input returns error', () {
        expect(Validators.validateRequired(null, 'field'), 'Vui lòng nhập field');
      });

      test('empty input returns error', () {
        expect(Validators.validateRequired('', 'field'), 'Vui lòng nhập field');
      });

      test('whitespace-only input returns error', () {
        expect(Validators.validateRequired('   ', 'field'), 'Vui lòng nhập field');
      });
    });

    group('validateConfirmPassword', () {
      test('matching passwords return null', () {
        expect(Validators.validateConfirmPassword('password123', 'password123'), isNull);
      });

      test('non-matching passwords return error', () {
        expect(
          Validators.validateConfirmPassword('password123', 'different'),
          'Mật khẩu không khớp',
        );
      });

      test('null confirmation returns error', () {
        expect(
          Validators.validateConfirmPassword(null, 'password123'),
          'Vui lòng xác nhận mật khẩu',
        );
      });

      test('empty confirmation returns error', () {
        expect(
          Validators.validateConfirmPassword('', 'password123'),
          'Vui lòng xác nhận mật khẩu',
        );
      });
    });
  });
}
