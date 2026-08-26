final class GenericCatch {
    void run() {
        try {
            doWork();
        } catch (Exception error) {
            throw new IllegalStateException(error);
        }
    }

    private void doWork() {
    }
}
