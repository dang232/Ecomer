// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_model.dart';

// **************************************************************************
// TypeAdapterGenerator
// **************************************************************************

class OrderModelAdapter extends TypeAdapter<OrderModel> {
  @override
  final int typeId = 1;

  @override
  OrderModel read(BinaryReader reader) {
    final numOfFields = reader.readByte();
    final fields = <int, dynamic>{
      for (int i = 0; i < numOfFields; i++) reader.readByte(): reader.read(),
    };
    return OrderModel(
      id: fields[0] as String,
      orderNumber: fields[1] as String,
      status: fields[2] as OrderStatus,
      items: (fields[3] as List).cast<OrderItemModel>(),
      subtotal: fields[4] as double,
      shippingFee: fields[5] as double,
      discount: fields[6] as double,
      totalAmount: fields[7] as double,
      shippingAddress: fields[8] as String?,
      shippingCity: fields[9] as String?,
      shippingDistrict: fields[10] as String?,
      shippingWard: fields[11] as String?,
      shippingPhone: fields[12] as String?,
      shippingName: fields[13] as String?,
      note: fields[14] as String?,
      createdAt: fields[15] as DateTime,
      updatedAt: fields[16] as DateTime?,
      estimatedDelivery: fields[17] as DateTime?,
      trackingNumber: fields[18] as String?,
      paymentMethod: fields[19] as String?,
      isPaid: fields[20] as bool,
    );
  }

  @override
  void write(BinaryWriter writer, OrderModel obj) {
    writer
      ..writeByte(21)
      ..writeByte(0)
      ..write(obj.id)
      ..writeByte(1)
      ..write(obj.orderNumber)
      ..writeByte(2)
      ..write(obj.status)
      ..writeByte(3)
      ..write(obj.items)
      ..writeByte(4)
      ..write(obj.subtotal)
      ..writeByte(5)
      ..write(obj.shippingFee)
      ..writeByte(6)
      ..write(obj.discount)
      ..writeByte(7)
      ..write(obj.totalAmount)
      ..writeByte(8)
      ..write(obj.shippingAddress)
      ..writeByte(9)
      ..write(obj.shippingCity)
      ..writeByte(10)
      ..write(obj.shippingDistrict)
      ..writeByte(11)
      ..write(obj.shippingWard)
      ..writeByte(12)
      ..write(obj.shippingPhone)
      ..writeByte(13)
      ..write(obj.shippingName)
      ..writeByte(14)
      ..write(obj.note)
      ..writeByte(15)
      ..write(obj.createdAt)
      ..writeByte(16)
      ..write(obj.updatedAt)
      ..writeByte(17)
      ..write(obj.estimatedDelivery)
      ..writeByte(18)
      ..write(obj.trackingNumber)
      ..writeByte(19)
      ..write(obj.paymentMethod)
      ..writeByte(20)
      ..write(obj.isPaid);
  }

  @override
  int get hashCode => typeId.hashCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is OrderModelAdapter &&
          runtimeType == other.runtimeType &&
          typeId == other.typeId;
}

class OrderStatusAdapter extends TypeAdapter<OrderStatus> {
  @override
  final int typeId = 2;

  @override
  OrderStatus read(BinaryReader reader) {
    switch (reader.readByte()) {
      case 0:
        return OrderStatus.pending;
      case 1:
        return OrderStatus.confirmed;
      case 2:
        return OrderStatus.processing;
      case 3:
        return OrderStatus.shipped;
      case 4:
        return OrderStatus.delivered;
      case 5:
        return OrderStatus.cancelled;
      default:
        return OrderStatus.pending;
    }
  }

  @override
  void write(BinaryWriter writer, OrderStatus obj) {
    switch (obj) {
      case OrderStatus.pending:
        writer.writeByte(0);
        break;
      case OrderStatus.confirmed:
        writer.writeByte(1);
        break;
      case OrderStatus.processing:
        writer.writeByte(2);
        break;
      case OrderStatus.shipped:
        writer.writeByte(3);
        break;
      case OrderStatus.delivered:
        writer.writeByte(4);
        break;
      case OrderStatus.cancelled:
        writer.writeByte(5);
        break;
    }
  }

  @override
  int get hashCode => typeId.hashCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is OrderStatusAdapter &&
          runtimeType == other.runtimeType &&
          typeId == other.typeId;
}
